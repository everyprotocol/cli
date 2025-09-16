import { Command, Option } from "commander";

// export const optRpcUrl = new Option("--rpc-url <url>", "RPC endpoint URL");
// export const optChainId = new Option("--chain-id <id>", "Chain ID").argParser(Number);
// export const optPkey = new Option("--private-key <hex>", "Sender private key");
// export const optFrom = new Option("--from <address>", "Sender address");
// export const optDerivePath = new Option("--path <hd>", "Derivation path (HD)");

// export const optVerbose = new Option("-v, --verbose", "Enable verbose logging");
// export const optSilent = new Option("--silent", "Suppress output");

export const optAccount = new Option("-a, --account <account>", "Name of the keystore");
export const optPassword = new Option("-p, --password [password]", "Password to decrypt the keystore");
export const optPasswordFile = new Option("--password-file <file>", "File containing the keystore password");
export const optPrivateKey = new Option("-k, --private-key <key>", "Private key to sign the transaction");
export const optFoundry = new Option("-f, --foundry", "Use foundry keystores (~/.foundry/keystores)");

export const optUniverse = new Option("-u, --universe <universe>", "universe name").default("anvil");
export const optNetwork = new Option("-n, --network <network>", "network name").default("dev");

export const accountOptions = [optAccount, optPassword, optPasswordFile, optFoundry];

(Command.prototype as unknown as Command).useOptions = function (options: Option[]) {
  options.forEach((o) => this.addOption(o));
  return this;
};

// (Command.prototype as unknown as Command).networkOptions = function () {
//   return (this as Command).useOptions(networkGroup);
// };

(Command.prototype as unknown as Command).accountOptions = function () {
  return (this as Command).useOptions(accountOptions);
};

(Command.prototype as unknown as Command).writeContractOptions = function () {
  return (this as Command).useOptions(accountOptions).addOption(optUniverse);
};
