import fs from "fs";
import path from "path";
import os from "os";
import { createPublicClient, http, createWalletClient, type PublicClient, type WalletClient, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Wallet } from "ethers";
import type { UniverseConfig, CommandConfig, ContractFunction } from "./types";
import { OptionValues } from "commander";
import promptSync from "prompt-sync";

const prompt = promptSync({ sigint: true });

export function getPublicClient(config: UniverseConfig): PublicClient {
  return createPublicClient({
    transport: http(config.rpcUrl),
  });
}

export async function getWalletClient(config: UniverseConfig, options: OptionValues): Promise<WalletClient> {
  let account;

  if (options.privateKey) {
    const privateKey = options.privateKey.startsWith("0x") ? options.privateKey : `0x${options.privateKey}`;
    account = privateKeyToAccount(privateKey as `0x${string}`);
  } else if (options.account) {
    const keystorePath = path.join(os.homedir(), ".every", "keystores", options.account);
    if (!fs.existsSync(keystorePath)) {
      throw new Error(`Keystore file not found: ${keystorePath}`);
    }

    const keystore = JSON.parse(fs.readFileSync(keystorePath, "utf8"));
    let password = "";

    if (options.password) {
      password = options.password;
    } else if (options.passwordFile) {
      if (!fs.existsSync(options.passwordFile)) {
        throw new Error(`Password file not found: ${options.passwordFile}`);
      }
      password = fs.readFileSync(options.passwordFile, "utf8").trim();
    } else if (keystore.crypto) {
      password = prompt("Enter password to decrypt keystore: ", { echo: "" });
    }

    try {
      // Use ethers to decrypt the keystore
      const wallet = await Wallet.fromEncryptedJson(JSON.stringify(keystore), password);
      account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
    } catch (error: any) {
      throw new Error(`Failed to decrypt keystore: ${error.message}`);
    }
  } else {
    throw new Error("No private key or account specified. Use --private-key or --account options.");
  }

  return createWalletClient({
    account,
    transport: http(config.rpcUrl),
  });
}

export function getContractAddress(
  uniConf: UniverseConfig,
  cmdConf: CommandConfig,
  func: ContractFunction,
  args: any[]
): Address {
  if (cmdConf.contract) {
    return uniConf.contracts[cmdConf.contract] as Address;
  } else {
    throw new Error(`getContractAddress not implemented for: ${JSON.stringify(cmdConf)}`);
  }
  // const contractKey = contract
  //   .replace(/^I/, "")
  //   .replace(/([A-Z])/g, "_$1")
  //   .toLowerCase()
  //   .replace(/^_/, "");
  // const address = uniConf.contracts[contractKey];
  // return address as Address;
}
