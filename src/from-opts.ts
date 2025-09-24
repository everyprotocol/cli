import { bytesToHex, createPublicClient, createWalletClient, http, PublicClient, WalletClient } from "viem";
import fs from "fs";
import path from "path";
import type { OptionValues } from "commander";
import { Wallet } from "ethers";
import { privateKeyToAccount } from "viem/accounts";
import promptSync from "prompt-sync";
import os from "os";
import { loadMergedConfig, Observer, Universe } from "./config.js";
import Keyring from "@polkadot/keyring";
import { UnifiedKeystore } from "./keystore.js";
import { decodePairFromJson, loadJson } from "./utils.js";
import { KeyringPair } from "@polkadot/keyring/cjs/types";
import { ApiPromise, WsProvider } from "@polkadot/api";

export const FromOpts = {
  getKeystoreDir: function (opts: OptionValues): string {
    if (opts.foundry) {
      return path.join(os.homedir(), ".foundry", "keystores");
    }
    if (opts.dir) {
      return opts.dir;
    }
    return path.join(os.homedir(), ".every", "keystores");
  },

  getKeystoreFile: function (opts: OptionValues, name: string): string {
    const dir = FromOpts.getKeystoreDir(opts);
    return path.join(dir, name);
  },

  getKeystore: async function (opts: OptionValues, account?: string): Promise<UnifiedKeystore> {
    const name = account ?? opts.account;
    if (!name) {
      throw new Error(`account not specified`);
    }
    const keyFile = FromOpts.getKeystoreFile(opts, account ?? opts.account);
    const keyData = loadJson(keyFile);
    const password = FromOpts.getPassword(opts);
    const keystore = await UnifiedKeystore.fromJSON(keyData, password);
    return keystore;
  },

  getPassword: function (opts: OptionValues): string {
    return opts.password
      ? opts.password
      : opts.passwordFile
        ? fs.readFileSync(opts.passwordFile, "utf8").trim()
        : promptSync({ sigint: true })("Enter keystore password: ", { echo: "" });
  },

  confirmPassword: function (opts: OptionValues): string {
    if (opts.password) {
      return opts.password;
    }
    if (opts.passwordFile) {
      return fs.readFileSync(opts.passwordFile, "utf8").trim();
    }
    const prompt = promptSync({ sigint: true });
    const password = prompt("Enter keystore password: ", { echo: "" });
    const confirmation = prompt("Re-enter to confirm: ", { echo: "" });
    if (password !== confirmation) {
      throw new Error(`Error: Passwords do not match`);
    }
    return password;
  },

  getUniverseConfig: function (opts: OptionValues): Universe {
    const config = loadMergedConfig();
    const universeName = opts.universe;
    const universe = config.universes[universeName];
    if (!universe) {
      const available = Object.keys(config.universes).join(", ");
      throw new Error(`Universe "${universeName}" not found. Available: ${available}`);
    }
    return universe;
  },

  getObserverConfig: function (options: OptionValues): Observer {
    const conf = loadMergedConfig();
    let observerName: string | undefined;
    const DEFAULT_OBSERVER = "localnet";
    if (options.network) {
      observerName = options.network;
    } else if (options.universe) {
      const universe = conf.universes[options.universe];
      if (!universe) {
        throw new Error(
          `Universe '${options.universe}' not found in config. Available: ${Object.keys(conf.universes).join(", ")}`
        );
      }
      observerName = universe.observer;
    } else {
      observerName = DEFAULT_OBSERVER;
    }

    if (!observerName) {
      throw new Error(`No observer resolved from options or config.`);
    }

    const observer = conf.observers[observerName];
    if (!observer) {
      throw new Error(
        `Observer '${observerName}' not found in config. Available: ${Object.keys(conf.observers).join(", ")}`
      );
    }
    return observer;
  },

  getPair: async function (opts: OptionValues): Promise<KeyringPair> {
    const keyFile = FromOpts.getKeystoreFile(opts, opts.account);
    const keyData = loadJson(keyFile);
    const keyring = new Keyring();
    const pair = keyring.createFromJson(keyData);
    if (pair.isLocked) {
      const password = FromOpts.getPassword(opts);
      pair.unlock(password);
    }
    return pair;
  },

  getPrivateKey: async function (opts: OptionValues) {
    if (opts.privateKey) {
      return opts.privateKey.startsWith("0x") ? opts.privateKey : `0x${opts.privateKey}`;
    } else if (opts.account) {
      const keyFile = FromOpts.getKeystoreFile(opts, opts.account);
      const keyData = loadJson(keyFile);
      if (keyData.crypto || keyData.Crypto) {
        // for Ethereum keystores
        const password = FromOpts.getPassword(opts);
        const wallet = await Wallet.fromEncryptedJson(JSON.stringify(keyData), password);
        return wallet.privateKey;
      } else if (keyData.encoding || keyData.meta) {
        // for Substrate keystores, must be ethereum type
        if (keyData.meta?.isEthereum || keyData.meta?.type === "ethereum") {
          const password = FromOpts.getPassword(opts);
          const pair = decodePairFromJson(keyData, password);
          return bytesToHex(pair.secretKey);
        } else {
          throw new Error("Not an Ethereum account");
        }
      } else {
        // Not supported for now
        throw new Error("Unknown keystore format");
      }
    } else {
      throw new Error(`Neither account nor private key specified`);
    }
  },

  toWriteEthereum: async function (
    opts: OptionValues
  ): Promise<{ publicClient: PublicClient; walletClient: WalletClient; conf: Universe }> {
    const conf: Universe = FromOpts.getUniverseConfig(opts);
    const transport = http(conf.rpc);
    const publicClient: PublicClient = createPublicClient({ transport });
    const privateKey = await FromOpts.getPrivateKey(opts);
    const account = privateKeyToAccount(privateKey);
    const walletClient: WalletClient = createWalletClient({ account, transport });
    return { publicClient, walletClient, conf };
  },

  toReadEthereum: function (opts: OptionValues): { publicClient: PublicClient; conf: Universe } {
    const conf: Universe = FromOpts.getUniverseConfig(opts);
    const transport = http(conf.rpc);
    const publicClient: PublicClient = createPublicClient({ transport });
    return { publicClient, conf };
  },

  getSubstrateApi: async function (opts: OptionValues): Promise<ApiPromise> {
    const conf: Observer = FromOpts.getObserverConfig(opts);
    const provider = new WsProvider(conf.rpc);
    const api = await ApiPromise.create({ provider, noInitWarn: true });
    return api;
  },
};
