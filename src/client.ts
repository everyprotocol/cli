import { createPublicClient, http, createWalletClient, type PublicClient, type WalletClient, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { UniverseConfig } from "./types";
import { OptionValues } from "commander";

export function getPublicClient(config: UniverseConfig): PublicClient {
  return createPublicClient({
    transport: http(config.rpc_url),
  });
}

import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";
import { createPublicClient, http, createWalletClient, type PublicClient, type WalletClient, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { HDAccount, fromPrivateKey, toAccount } from "viem/accounts";
import type { UniverseConfig } from "./types";
import { OptionValues } from "commander";

export function getPublicClient(config: UniverseConfig): PublicClient {
  return createPublicClient({
    transport: http(config.rpc_url),
  });
}

export function getWalletClient(config: UniverseConfig, options: OptionValues): WalletClient {
  let account;
  
  // If private key is provided directly
  if (options.privateKey) {
    const privateKey = options.privateKey.startsWith('0x') 
      ? options.privateKey 
      : `0x${options.privateKey}`;
    account = privateKeyToAccount(privateKey as `0x${string}`);
  } 
  // If account name is provided, load from keystore
  else if (options.account) {
    const keystorePath = path.join(os.homedir(), '.every', 'keystores', options.account);
    
    if (!fs.existsSync(keystorePath)) {
      throw new Error(`Keystore file not found: ${keystorePath}`);
    }
    
    const keystore = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));
    let password = '';
    
    // Get password from options or file
    if (options.password) {
      password = options.password;
    } else if (options.passwordFile) {
      if (!fs.existsSync(options.passwordFile)) {
        throw new Error(`Password file not found: ${options.passwordFile}`);
      }
      password = fs.readFileSync(options.passwordFile, 'utf8').trim();
    } else if (keystore.crypto) {
      // If keystore is encrypted and no password provided, prompt for it
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      // Synchronous password prompt
      password = promptSync('Enter password to decrypt keystore: ');
    }
    
    try {
      // This is a simplified version - in a real implementation you would use
      // a proper keystore decryption function
      const privateKey = decryptKeystore(keystore, password);
      account = privateKeyToAccount(privateKey as `0x${string}`);
    } catch (error) {
      throw new Error(`Failed to decrypt keystore: ${error.message}`);
    }
  } else {
    throw new Error('No private key or account specified. Use --private-key or --account options.');
  }
  
  return createWalletClient({
    account,
    transport: http(config.rpc_url),
  });
}

// Helper function for synchronous password prompt
function promptSync(question: string): string {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise<string>((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  }).then(result => {
    // This is a hack to make it synchronous
    let response = '';
    const deasync = require('deasync');
    let done = false;
    
    Promise.resolve(result).then(res => {
      response = res;
      done = true;
    });
    
    deasync.loopWhile(() => !done);
    return response;
  });
}

// Simplified keystore decryption function
// In a real implementation, you would use a proper library for this
function decryptKeystore(keystore: any, password: string): string {
  // This is a placeholder - in a real implementation you would use
  // a proper keystore decryption function like web3.eth.accounts.decrypt
  if (!keystore.crypto) {
    // Unencrypted keystore
    return keystore.privateKey;
  }
  
  // For encrypted keystores, you would implement proper decryption here
  // This is just a placeholder
  if (!password) {
    throw new Error('Password required to decrypt keystore');
  }
  
  // Simplified check - in reality you would use proper crypto functions
  if (keystore.crypto.kdf === 'scrypt' || keystore.crypto.kdf === 'pbkdf2') {
    // Pretend we're decrypting
    return keystore.privateKey || '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  }
  
  throw new Error(`Unsupported keystore format`);
}

export function getContractAddress(config: UniverseConfig, contract: string, args: any[]): Address {
  // Convert contract name to config key format (e.g., IKindRegistry -> kind_registry)
  const contractKey = contract
    .replace(/^I/, "")
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
  const c = config.contracts[contractKey];
  return c as Address;
}

export function getContractAddress(config: UniverseConfig, contract: string, args: any[]): Address {
  // Convert contract name to config key format (e.g., IKindRegistry -> kind_registry)
  const contractKey = contract
    .replace(/^I/, "")
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
  const c = config.contracts[contractKey];
  return c as Address;
}
