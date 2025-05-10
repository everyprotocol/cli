import { Command } from "commander";
import fs from "fs";
import path from "path";
import { encodeAbiParameters, toFunctionSignature, parseEventLogs } from "viem";
import { formatAbiParameter } from "abitype";
import JSON5 from "json5";
import type { ContractFunction, UniverseConfig, CommandConfig } from "./types";
import { getWalletClient, getPublicClient, getContractAddress } from "./client";
import { getUniverseConfig } from "./config";

function loadAbi(name: string): any {
  const abiPath = path.resolve(process.cwd(), "abis", `${name}.json`);
  const abiContent = fs.readFileSync(abiPath, "utf8");
  const abi = JSON.parse(abiContent);
  return abi;
}

function sort(a: ContractFunction, b: ContractFunction): number {
  return a.stateMutability == b.stateMutability ? 0 : a.stateMutability == "view" ? 1 : -1;
}

export function defineSubCommands(parent: Command, config: CommandConfig): Command {
  try {
    const { name, interface: intfAbiFile, contract: implAbiFile, rename, filter } = config;
    const nonFuncAbiItems = implAbiFile ? extractErrorsAndEvents(loadAbi(implAbiFile)) : [];
    let funcAbiItems = extractFunctions(loadAbi(intfAbiFile));
    const filtered = filter ? funcAbiItems.filter(filter) : funcAbiItems;

    // Add level2 commands to the parent command
    addLevel2Commands(parent, filtered, nonFuncAbiItems, config, rename);

    return parent;
  } catch (error) {
    console.error(`Error configuring subcommand ${config.name} from ${config.interface}:`, error);
    return parent;
  }
}

/**
 * Adds level2 commands to a parent command
 */
function addLevel2Commands(
  parent: Command,
  funcAbiItems: ContractFunction[],
  nonFuncAbiItems: ContractFunction[],
  config: CommandConfig,
  rename?: (name: string) => string
): void {
  // Track command names to handle duplicates, level2CmdName => count
  const level2CmdCounts = new Map<string, number>();

  // Generate a command for each function
  funcAbiItems.sort(sort).forEach((funcAbiItem: ContractFunction) => {
    let cmdName = rename ? rename(funcAbiItem.name) : funcAbiItem.name;
    let count: number = level2CmdCounts.get(cmdName) || 0;
    let postfix = count > 0 ? `${count + 1}` : "";
    level2CmdCounts.set(cmdName, count + 1);
    const level2CmdName = `${cmdName}${postfix}`;
    defineCommandFromFunction(parent, level2CmdName, funcAbiItem, nonFuncAbiItems, config);
  });
}

export function extractErrorsAndEvents(abi: any): ContractFunction[] {
  return (abi.abi || []).filter((item: any) => item.type == "error" || item.type == "event");
}

export function extractFunctions(abi: any): ContractFunction[] {
  const abiItems = abi.abi || [];
  const metadata = abi.metadata?.output || {};
  const userMethods = metadata.userdoc?.methods || {};
  const devMethods = metadata.devdoc?.methods || {};
  return abiItems
    .filter((item: any) => item.type === "function")
    .map((item: any) => {
      const signature = toFunctionSignature(item);
      const userdoc = userMethods[signature] || {};
      const devdoc = devMethods[signature] || {};
      const _metadata = {
        signature,
        ...devdoc,
        ...userdoc,
      };
      return {
        ...item,
        _metadata,
      } as ContractFunction;
    });
}

export function defineCommandFromFunction(
  parent: Command,
  name: string,
  funcAbiItem: ContractFunction,
  nonFuncAbiItems: ContractFunction[],
  config: CommandConfig
): Command {
  let desc = funcAbiItem._metadata?.notice || `Call ${funcAbiItem.name} function`;
  const cmd = parent.command(name).description(desc);
  funcAbiItem.inputs.forEach((input) => {
    const argDesc = funcAbiItem._metadata?.params?.[input.name] || `${input.type} parameter`;
    cmd.argument(`<${input.name}>`, argDesc);
  });

  if (funcAbiItem.stateMutability === "view" || funcAbiItem.stateMutability === "pure") {
    cmd
      .option("-u, --universe <universe>", "Universe name", "local")
      .action(readContract(funcAbiItem, nonFuncAbiItems, config));
  } else {
    cmd
      .option("-u, --universe <universe>", "Universe name", "local")
      .option("-a, --account <account>", "Account address to use for the transaction")
      .option("-k, --private-key <key>", "Private key to sign the transaction")
      .option("-p, --password [password]", "Password to decrypt the private key")
      .option("-f, --password-file <file>", "File containing the password to decrypt the private key")
      .action(writeContract(funcAbiItem, nonFuncAbiItems, config));
  }
  return cmd;
}

function checkArguments(raw: any[], func: ContractFunction): any[] {
  return raw.map((rawArg, index) => {
    const abiParam = func.inputs[index];
    const pt = abiParam?.type;
    const arg = pt === "address" || pt.startsWith("bytes") || pt === "string" ? rawArg : JSON5.parse(rawArg);
    try {
      encodeAbiParameters([abiParam], [arg]);
    } catch (e: any) {
      console.log(formatAbiParameter(abiParam));
      throw new Error(`invalid param ${abiParam.name}(${abiParam.internalType}): ${e.message}`);
    }
    return arg;
  });
}

function writeContract(
  func: ContractFunction,
  nonFuncAbiItems: ContractFunction[],
  cmdConf: CommandConfig
): (this: Command) => Promise<void> {
  return async function (this: Command) {
    const opts = this.opts();
    const uniConf: UniverseConfig = getUniverseConfig(opts);
    const args = checkArguments(this.args, func);
    const publicClient = getPublicClient(uniConf);
    const walletClient = await getWalletClient(uniConf, opts);
    const contractAddress = getContractAddress(uniConf, cmdConf, func, args);
    console.log({ contractAddress, args, opts, config: uniConf });

    const { request } = await publicClient.simulateContract({
      address: contractAddress,
      abi: [func, ...nonFuncAbiItems],
      functionName: func.name,
      args: args as any[],
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(request);
    console.log(`Transaction sent: ${hash}`);
    console.log("Waiting for transaction to be mined...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("Transaction mined");
    if (receipt.logs && receipt.logs.length > 0) {
      console.log("\nEvents emitted:");
      const parsedLogs = parseEventLogs({
        abi: [func, ...nonFuncAbiItems],
        logs: receipt.logs,
      });
      parsedLogs.forEach((log: any) => {
        console.log({ event: log.eventName, args: log.args });
      });
      // console.log(parsedLogs);
    } else {
      console.log("\nNo events emitted");
    }
  };
}

function readContract(
  func: ContractFunction,
  nonFuncAbiItems: ContractFunction[],
  cmdConf: CommandConfig
): (this: Command) => Promise<void> {
  return async function (this: Command) {
    const opts = this.opts();
    const uniConf: UniverseConfig = getUniverseConfig(opts);
    const publicClient = getPublicClient(uniConf);
    const args = checkArguments(this.args, func);
    const contractAddress = getContractAddress(uniConf, cmdConf, func, args);

    console.log({ contractAddress, args, opts, config: uniConf });
    console.log(`Calling view function on ${func.name}...`);
    const result = await publicClient.readContract({
      address: contractAddress,
      abi: [func, ...nonFuncAbiItems],
      functionName: func.name,
      args: args as any[],
    });
    console.log(`Result:`, result);
  };
}
