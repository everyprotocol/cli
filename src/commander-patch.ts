import { Argument, Command, Option } from "commander";

export const account = new Option("-a, --account <account>", "Name of the keystore");
export const password = new Option("-p, --password [password]", "Password to decrypt the keystore");
export const passwordFile = new Option("-P, --password-file <file>", "File containing the keystore password");
export const privateKey = new Option("-k, --private-key <key>", "Private key to sign the transaction");
export const foundry = new Option("-f, --foundry", "Use foundry keystores (~/.foundry/keystores)");

export const universe = new Option("-u, --universe <universe>", "Universe name").default("anvil");
export const network = new Option("-n, --network <network>", "Network name").default("dev");

export const json = new Option("-j, --json [file]", "Output result as JSON to stdout or file, implies --quiet");
export const quiet = new Option("-q, --quiet", "Suppress info messages");
export const noQuiet = new Option("--no-quiet", "Force info messages even when --json is set");

export const keystoreOptions = [account, password, passwordFile, foundry];
export const outputOptions = [json, quiet, noQuiet];
export const writeOptions = [universe, account, password, passwordFile, foundry];

(Command.prototype as unknown as Command).addCommands = function (commands: Command[]) {
  commands.forEach((cmd) => this.addCommand(cmd));
  return this;
};

(Command.prototype as unknown as Command).addArguments = function (arg: Argument[]) {
  arg.forEach((arg) => this.addArgument(arg));
  return this;
};

(Command.prototype as unknown as Command).addOptions = function (options: Option[]) {
  options.forEach((opt) => this.addOption(opt));
  return this;
};

(Command.prototype as unknown as Command).addKeystoreOptions = function () {
  return (this as Command).addOptions([account, password, passwordFile, foundry]);
};

(Command.prototype as unknown as Command).addOutputOptions = function () {
  return (this as Command).addOptions([json, quiet, noQuiet]);
};

(Command.prototype as unknown as Command).addWriteOptions = function () {
  return this.addKeystoreOptions().addOption(universe);
};
