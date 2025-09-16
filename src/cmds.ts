import { Argument, Command, Option, CommandOptions } from "commander";
import { Address, createPublicClient, http, parseEventLogs, stringify } from "viem";
import { Universe as UniverseConfig } from "./config.js";
import { AbiEventOrError, AbiFunctionDoc } from "./abi.js";
import { checkArguments, getClientsEth, getUniverseConfig } from "./utils.js";

export interface CommandContext {
  conf: UniverseConfig;
  contract: string;
  cmdAbi: AbiFunctionDoc;
  txnAbi: AbiFunctionDoc;
  nonFuncs: AbiEventOrError[];
  cmd: Command;
  txnPrepare: (
    ctx: CommandContext
  ) => { address: Address; tag: string; args: unknown[] } | Promise<{ address: Address; tag: string; args: unknown[] }>;
}

export interface CommandConfig {
  contract: string;
  nonFuncs: AbiEventOrError[];

  cmdAbi?: (txnAbi: AbiFunctionDoc) => AbiFunctionDoc;
  cmdName?: (cmdAbi: AbiFunctionDoc) => string;
  cmdDescription?: (cmdAbi: AbiFunctionDoc) => string;
  cmdOptions?: (cmdAbi: AbiFunctionDoc) => Option[];
  cmdArguments?: (cmdAbi: AbiFunctionDoc) => Argument[];
  cmdAction?: (ctx: CommandContext) => Promise<void>;

  txnPrepare?: (
    ctx: CommandContext
  ) => { address: Address; tag: string; args: unknown[] } | Promise<{ address: Address; tag: string; args: unknown[] }>;
}

export function defaultReadFunctionOptions() {
  const options = [];
  options.push(new Option("-u, --universe <universe>", "universe name").default("local"));
  options.push(new Option("--dry-run", "Simulate the command without sending a transaction"));
  return options;
}

export function defaultWriteFunctionOptions() {
  const options = [];
  options.push(new Option("-u, --universe <universe>", "universe name").default("local"));
  options.push(new Option("-k, --private-key <key>", "private key to sign the transaction"));
  options.push(new Option("-a, --account <account>", "name of the keystore to sign the transaction"));
  options.push(new Option("-p, --password [password]", "password to decrypt the keystore"));
  options.push(new Option("--password-file <file>", "file containing the password to decrypt the keystore"));
  options.push(new Option("-f, --foundry", "use keystore from Foundry directory (~/.foundry/keystores)"));
  options.push(new Option("--dry-run", "Simulate the command without sending a transaction"));
  return options;
}

const defaultConfig = {
  cmdAbi: (txnAbi: AbiFunctionDoc) => txnAbi,
  cmdName: (cmdAbi: AbiFunctionDoc) => cmdAbi.name,
  cmdDescription: (cmdAbi: AbiFunctionDoc) => cmdAbi._metadata?.notice || cmdAbi.name,
  cmdOptions: (cmdAbi: AbiFunctionDoc) => {
    const read = cmdAbi.stateMutability == "view" || cmdAbi.stateMutability == "pure";
    return read ? defaultReadFunctionOptions() : defaultWriteFunctionOptions();
  },
  cmdArguments: (cmdAbi: AbiFunctionDoc) =>
    cmdAbi.inputs.map((input) => {
      const argDesc = cmdAbi._metadata?.params?.[input.name!] || `${input.type} parameter`;
      return new Argument(`<${input.name}>`, argDesc);
    }),
  cmdAction: async function (ctx: CommandContext) {
    const isRead = ctx.cmdAbi.stateMutability == "view" || ctx.cmdAbi.stateMutability == "pure";
    const opts = ctx.cmd.opts();
    const args0 = ctx.cmd.args;
    console.log({ args0 });
    const { address, tag, args } = await ctx.txnPrepare(ctx);
    const abi = [ctx.txnAbi, ...ctx.nonFuncs];
    const functionName = ctx.txnAbi.name;
    if (isRead) {
      const publicClient = createPublicClient({ transport: http(ctx.conf.rpc) });
      const result = await publicClient.readContract({ address, abi, functionName, args });
      console.log(`Result:`, result);
    } else {
      const { publicClient, walletClient } = await getClientsEth(ctx.conf, opts);
      const account = walletClient.account;
      console.log({
        isRead,
        address: `${address} (${tag})`,
        account: account?.address,
        signature: ctx.txnAbi._metadata.signature!,
        args,
      });
      const { request } = await publicClient.simulateContract({ address, abi, functionName, args, account });
      const hash = await walletClient.writeContract(request);
      console.log(`Transaction sent: ${hash}`);
      console.log("Transaction mining...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log("Transaction mined");

      if (receipt.logs && receipt.logs.length > 0) {
        const parsedLogs = parseEventLogs({ abi, logs: receipt.logs });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parsedLogs.forEach((log: any) => {
          console.log(" - Event", log.eventName, stringify(log.args));
        });
      }
    }
    console.log({ isRead, address: `${address} (${tag})`, signature: ctx.txnAbi._metadata.signature!, args });
    return;
  },

  txnPrepare: function (ctx: CommandContext): { address: Address; tag: string; args: unknown[] } {
    const args = checkArguments(ctx.cmd.args, ctx.cmdAbi);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { address: (ctx.conf.contracts as any)[ctx.contract] as Address, tag: ctx.contract, args };
  },
};

export function configureCommand(txnAbi: AbiFunctionDoc, config: CommandConfig) {
  const cmdAbi = (config.cmdAbi || defaultConfig.cmdAbi)(txnAbi);
  const name = (config.cmdName || defaultConfig.cmdName)(cmdAbi);
  const desc = (config.cmdDescription || defaultConfig.cmdDescription)(cmdAbi);
  const opts = (config.cmdOptions || defaultConfig.cmdOptions)(cmdAbi);
  const args = (config.cmdArguments || defaultConfig.cmdArguments)(cmdAbi);

  const action = async function (this: Command) {
    const ctx = {
      conf: getUniverseConfig(this.opts()),
      contract: config.contract,
      cmdAbi,
      txnAbi,
      nonFuncs: config.nonFuncs,
      cmd: this,
      txnPrepare: config.txnPrepare || defaultConfig.txnPrepare,
    } as CommandContext;
    await (config.cmdAction || defaultConfig.cmdAction!)(ctx);
  };

  const cmd = new Command();
  cmd.name(name);
  cmd.description(desc);
  opts.forEach((opt) => cmd.addOption(opt));
  args.forEach((arg) => cmd.addArgument(arg));
  cmd.action(action);
  return cmd;
}

export class RenamingCommand extends Command {
  private nameCounts = new Map<string, number>();

  override addCommand(cmd: Command, opts?: CommandOptions): this {
    const originalName = cmd.name();
    const uniqueName = this.getUniqueName(originalName);
    if (originalName !== uniqueName) {
      cmd.name(uniqueName);
    }
    return super.addCommand(cmd, opts);
  }

  addCommands(cmds: Command[]): RenamingCommand {
    cmds.forEach((cmd) => this.addCommand(cmd));
    return this;
  }

  resetCounts(name?: string): void {
    if (name) {
      this.nameCounts.delete(name);
    } else {
      this.nameCounts.clear();
    }
  }

  private getUniqueName(baseName: string): string {
    const count = this.nameCounts.get(baseName) || 0;
    this.nameCounts.set(baseName, count + 1);
    return count === 0 ? baseName : `${baseName}${count + 1}`;
  }
}
