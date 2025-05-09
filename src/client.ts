import fs from "fs";
import path from "path";
import os from "os";
import { createPublicClient, http, createWalletClient, type PublicClient, type WalletClient, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { UniverseConfig } from "./types";
import { OptionValues } from "commander";
import promptSync from "prompt-sync";

const prompt = promptSync({ sigint: true });

export function getPublicClient(config: UniverseConfig): PublicClient {
  return createPublicClient({
    transport: http(config.rpc_url),
  });
}

export function getWalletClient(config: UniverseConfig, options: OptionValues): WalletClient {
  let account;

  if (options.privateKey) {
    const privateKey = options.privateKey.startsWith("0x") ? options.privateKey : `0x${options.privateKey}`;
    account = privateKeyToAccount(privateKey as `0x${string}`);
  } else if (options.account) {
    // ai! use ethers to load json keystore
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
      const privateKey = decryptKeystore(keystore, password);
      account = privateKeyToAccount(privateKey as `0x${string}`);
    } catch (error: any) {
      throw new Error(`Failed to decrypt keystore: ${error.message}`);
    }
  } else {
    throw new Error("No private key or account specified. Use --private-key or --account options.");
  }

  return createWalletClient({
    account,
    transport: http(config.rpc_url),
  });
}

// Placeholder decryption logic — replace with real library
function decryptKeystore(keystore: any, password: string): string {
  if (!keystore.crypto) {
    return keystore.privateKey;
  }

  if (!password) {
    throw new Error("Password required to decrypt keystore");
  }

  if (keystore.crypto.kdf === "scrypt" || keystore.crypto.kdf === "pbkdf2") {
    return keystore.privateKey || "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  }

  throw new Error(`Unsupported keystore format`);
}

export function getContractAddress(config: UniverseConfig, contract: string, args: any[]): Address {
  const contractKey = contract
    .replace(/^I/, "")
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
  const address = config.contracts[contractKey];
  return address as Address;
}
