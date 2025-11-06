import { Argument, Command, Option } from "commander";
import { SubReadAction, SubWriteAction } from "./types/commander.js";
import { FromOpts } from "./from-opts.js";

export const account = new Option("-a, --account <account>", "Name of the keystore");
export const password = new Option("-p, --password [password]", "Password to decrypt the keystore");
export const passwordFile = new Option("-P, --password-file <file>", "File containing the keystore password");
export const privateKey = new Option("-k, --private-key <key>", "Private key to sign the transaction");
export const foundry = new Option("-f, --foundry", "Use foundry keystores (~/.foundry/keystores)");

export const universe = new Option("-u, --universe <universe>", "Universe name").default("local");
export const network = new Option("-n, --network <network>", "Network name").default("local");

export const json = new Option("-j, --json [file]", "Output result as JSON to stdout or file");
export const quiet = new Option("-q, --quiet", "Suppress info messages");

export const keystoreOptions = [account, password, passwordFile, foundry];
export const outputOptions = [json, quiet];
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
  return (this as Command).addOptions([json, quiet]);
};

(Command.prototype as unknown as Command).addWriteOptions = function () {
  return this.addKeystoreOptions().addOption(universe);
};

(Command.prototype as unknown as Command).subReadAction = function (fn: SubReadAction) {
  // eslint-disable-next-line
  return this.action(async function (this: Command, ...args: any[]) {
    const api = await FromOpts.getSubstrateApi(this.opts());
    try {
      return await fn.call(this, api, ...args);
    } finally {
      await api.disconnect().catch(() => {});
    }
  });
};

(Command.prototype as unknown as Command).subWriteAction = function (fn: SubWriteAction) {
  // eslint-disable-next-line
  async function _action(this: Command, ...args: any[]) {
    const opts = this.opts();
    const api = await FromOpts.getSubstrateApi(opts);
    try {
      const keystore = await FromOpts.getKeystore(opts);
      const pair = await keystore.pair();
      return await fn.call(this, api, pair, ...args);
    } finally {
      await api.disconnect().catch(() => {});
    }
  }
  return this.action(_action);
};
