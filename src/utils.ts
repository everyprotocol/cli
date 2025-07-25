import {
  bytesToHex,
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  http,
  PublicClient,
  WalletClient,
} from "viem";
import { formatAbiParameter } from "abitype";
import fs from "fs";
import path from "path";
import { OptionValues } from "commander";
import { Wallet } from "ethers";
import { privateKeyToAccount } from "viem/accounts";
import promptSync from "prompt-sync";
import os from "os";
import JSON5 from "json5";
import { fileURLToPath } from "url";
import { isHex, hexToU8a } from "@polkadot/util";
import { base64Decode } from "@polkadot/util-crypto/base64";
import { decodePair } from "@polkadot/keyring/pair/decode";
import { AbiFunctionDoc } from "./abi.js";
import { UniverseConfig } from "./config.js";
import Keyring from "@polkadot/keyring";

export const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function version() {
  const pkgPath = path.resolve(__dirname, "../package.json");
  return JSON.parse(fs.readFileSync(pkgPath, "utf-8")).version;
}

export function lstrip(prefix: string) {
  return function (func: AbiFunctionDoc): string {
    return func.name.startsWith(prefix) ? func.name.substring(prefix.length).toLowerCase() : func.name;
  };
}

export function rstrip(postfix: string) {
  return function (func: AbiFunctionDoc): string {
    return func.name.endsWith(postfix) ? func.name.slice(0, -postfix.length) : func.name;
  };
}

export function startsWith(prefix: string) {
  return function (func: AbiFunctionDoc): boolean {
    return func.name.startsWith(prefix);
  };
}

export function excludes(names: string[]) {
  return function (func: AbiFunctionDoc): boolean {
    return !names.includes(func.name);
  };
}

export function includes(names: string[]) {
  return function (f: AbiFunctionDoc): boolean {
    return names.includes(f.name);
  };
}

export function stringify(o: unknown) {
  const replacer = (_key: string, value: unknown) => (typeof value === "bigint" ? value.toString() : value);
  return JSON5.stringify(o, replacer);
}

export async function getClientsEth(
  uniConf: UniverseConfig,
  opts: OptionValues
): Promise<{ publicClient: PublicClient; walletClient: WalletClient }> {
  const transport = http(uniConf.rpc);
  const publicClient: PublicClient = createPublicClient({ transport });
  const privateKey = await readPrivateKeyEth(opts);
  const account = privateKeyToAccount(privateKey);
  const walletClient: WalletClient = createWalletClient({ account, transport });
  return { publicClient, walletClient };
}

export async function readPrivateKeyEth(opts: OptionValues) {
  if (opts.privateKey) {
    return opts.privateKey.startsWith("0x") ? opts.privateKey : `0x${opts.privateKey}`;
  } else if (opts.account) {
    const keystorePath = resolveKeystoreFile(opts.account, opts);
    const keystore = loadKeystore(keystorePath);

    if (keystore.crypto || keystore.Crypto) {
      // for Ethereum keystores
      const password = getPassword(opts);
      const wallet = await Wallet.fromEncryptedJson(JSON.stringify(keystore), password);
      return wallet.privateKey;
    } else if (keystore.encoding || keystore.meta) {
      // for Substrate keystores
      if (keystore.meta?.isEthereum || keystore.meta?.type === "ethereum") {
        const password = getPassword(opts);
        const pair = decodeSubstratePair(keystore, password);
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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkArguments(raw: unknown[], func: AbiFunctionDoc): any[] {
  return raw.map((rawArg, index) => {
    const abiParam = func.inputs[index];
    const pt = abiParam?.type;
    const arg = pt === "address" || pt.startsWith("bytes") || pt === "string" ? rawArg : JSON5.parse(rawArg as string);
    try {
      encodeAbiParameters([abiParam], [arg]);
    } catch (e: unknown) {
      if (e instanceof Error) {
        throw new Error(`invalid param ${formatAbiParameter(abiParam)}\n${e.message}`);
      }
    }
    return arg;
  });
}

export function resolveKeystoreDir(options: OptionValues): string {
  if (options.foundry) {
    return path.join(os.homedir(), ".foundry", "keystores");
  }
  if (options.dir) {
    return options.dir;
  }
  return path.join(os.homedir(), ".every", "keystores");
}

export function resolveKeystoreFile(name: string, options: OptionValues): string {
  const dir = resolveKeystoreDir(options);
  return path.join(dir, name);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saveKeystore(json: any, name: string, options: OptionValues) {
  const dir = resolveKeystoreDir(options);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const file = path.join(dir, name);
  if (fs.existsSync(file)) {
    throw new Error(`File exists: ${file}`);
  }
  fs.writeFileSync(file, JSON.stringify(json));
  console.log(`File saved: ${file}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadKeystore(file: string): any {
  if (!fs.existsSync(file)) {
    throw new Error(`Keystore file not found: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function getPassword(opts: OptionValues): string {
  return opts.password
    ? opts.password
    : opts.passwordFile
      ? fs.readFileSync(opts.passwordFile, "utf8").trim()
      : promptSync({ sigint: true })("Password: ", { echo: "" });
}

export function getPasswordConfirm(opts: OptionValues): string {
  if (opts.password) {
    return opts.password;
  }
  if (opts.passwordFile) {
    return fs.readFileSync(opts.passwordFile, "utf8").trim();
  }
  const prompt = promptSync({ sigint: true });
  const password = prompt("Password: ", { echo: "" });
  const confirmation = prompt("Confirm: ", { echo: "" });
  if (password !== confirmation) {
    throw new Error(`Error: Passwords do not match`);
  }
  return password;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decodeSubstratePair(keystore: any, password?: string) {
  const encodedRaw = keystore.encoded;
  let encodingType = keystore.encoding.type;
  encodingType = !Array.isArray(encodingType) ? [encodingType] : encodingType;
  const encoded = isHex(encodedRaw) ? hexToU8a(encodedRaw) : base64Decode(encodedRaw);
  const decoded = decodePair(password, encoded, encodingType);
  return decoded;
}

export function getSubstrateAccountPair(flags: OptionValues) {
  const keyFile = resolveKeystoreFile(flags.account, flags);
  const keyData = loadKeystore(keyFile);
  const keyring = new Keyring();
  const pair = keyring.createFromJson(keyData);
  if (pair.isLocked) {
    const password = getPassword(flags);
    pair.unlock(password);
  }
  return pair;
}
