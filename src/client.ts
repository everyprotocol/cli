import { createPublicClient, http, createWalletClient, type PublicClient, type WalletClient, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { UniverseConfig } from "./types";
import { OptionValues } from "commander";

export function getPublicClient(config: UniverseConfig): PublicClient {
  return createPublicClient({
    transport: http(config.rpc_url),
  });
}

export function getWalletClient(config: UniverseConfig, options: OptionValues): WalletClient {
  // ai! implement
  // if --private-key is set in options, use this private key
  // else if --account is set, use it as a keystore name, the file path is ~/.every/keystores/${name}
  // if --password-file or --password is set, use file content or value to decrypt the keystore, if the keystore is encrypted, but both password-file or --password are not set, input from terminal
  return createWalletClient({
    account: privateKeyToAccount("privateKey" as `0x${string}`),
    transport: http(config.rpc_url),
  });
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
