import { Command, InvalidArgumentError, type OptionValues } from "commander";
import fs from "fs";
import path from "path";
import { BaseError, ContractFunctionRevertedError, encodeAbiParameters, toFunctionSignature } from "viem";
import { formatAbiParameter, InvalidParameterError, SolidityAddress } from "abitype";
import JSON5 from "json5";
import type { ContractFunction, UniverseConfig, CommandConfig } from "./types";
import { getWalletClient, getPublicClient, getContractAddress } from "./client";
import { getUniverseConfig } from "./config";

export function configureSubCommand(program: Command, config: CommandConfig): Command {
  try {
    const { name, abiFile, rename, filter } = config;

    const abiPath = path.resolve(process.cwd(), "abis", abiFile);
    const abiContent = fs.readFileSync(abiPath, "utf8");
    const abi = JSON.parse(abiContent);
    const contractName = path.basename(abiFile, path.extname(abiFile));
    
    // Extract all functions, errors, and events
    const allItems = extractFunctions(abi);
    
    // Filter to only include functions for CLI commands
    const functionItems = allItems.filter(item => item.type === "function");
    
    // Apply custom filter if provided
    const filtered = filter ? functionItems.filter(filter) : functionItems;

    // Create the main command for this contract
    const level1Cmd = program.command(name).description(`${name} commands for ${contractName}`);
    
    // Track command names to handle duplicates
    const level2Cmds = new Map<string, number>();
    
    // Generate a command for each function
    filtered.forEach((func: ContractFunction) => {
      let funcName = rename ? rename(func.name) : func.name;
      let num: number = level2Cmds.get(funcName) || 0;
      const level2CmdName = num > 0 ? `${funcName}${num + 1}` : funcName;
      level2Cmds.set(funcName, num + 1);
      generateFunctionCommand(level1Cmd, level2CmdName, func, contractName);
    });
    
    return program;
  } catch (error) {
    console.error(`Error configuring subcommand ${config.name} from ${config.abiFile}:`, error);
    return program;
  }
}

export function extractFunctions(abi: any): ContractFunction[] {
  // Extract all functions, errors, and events
  return abi.abi
    .filter((item: any) => ["function", "error", "event"].includes(item.type))
    .map((item: any) => {
      // Generate signature for the item
      const signature = item.type === "function" 
        ? toFunctionSignature(item)
        : `${item.name}(${(item.inputs || []).map((i: any) => i.type).join(',')})`;
      
      // Handle case where metadata might not exist or have expected structure
      const metadata = abi.metadata?.output || { userdoc: { methods: {}, events: {}, errors: {} }, devdoc: { methods: {}, events: {}, errors: {} } };
      
      // Get documentation based on item type
      let userdoc = {};
      let devdoc = {};
      
      if (item.type === "function") {
        userdoc = metadata.userdoc?.methods?.[signature] || {};
        devdoc = metadata.devdoc?.methods?.[signature] || {};
      } else if (item.type === "event") {
        userdoc = metadata.userdoc?.events?.[signature] || {};
        devdoc = metadata.devdoc?.events?.[signature] || {};
      } else if (item.type === "error") {
        userdoc = metadata.userdoc?.errors?.[signature] || {};
        devdoc = metadata.devdoc?.errors?.[signature] || {};
      }
      
      // Merge documentation with priority to userdoc
      const mergedDocs = {
        signature,
        ...devdoc,  // devdoc first (lower priority)
        ...userdoc, // userdoc overrides (higher priority)
        // Merge params from both sources if they exist
        params: {
          ...(devdoc.params || {}),
          ...(userdoc.params || {})
        }
      };
      
      // Only include params if they exist
      if (Object.keys(mergedDocs.params).length === 0) {
        delete mergedDocs.params;
      }
      
      return { ...item, _metadata: mergedDocs } as ContractFunction;
    });
}

export function generateFunctionCommand(
  cmd: Command,
  name: string,
  func: ContractFunction,
  contractName: string
): Command {
  // Skip generating commands for errors and events
  if (func.type !== "function") {
    return cmd;
  }
  
  // Use notice from metadata or generate a default description
  let desc = func._metadata?.notice || `Call ${func.name} function`;
  const subCmd = cmd.command(name).description(desc);
  
  // Add arguments for each input parameter
  func.inputs.forEach((input) => {
    const paramDesc = func._metadata?.params?.[input.name] || `${input.type} parameter`;
    subCmd.argument(`<${input.name}>`, paramDesc);
  });
  
  // Determine if this is a read-only function
  const isReadFunction = func.stateMutability === "view" || func.stateMutability === "pure";
  
  if (isReadFunction) {
    subCmd.option("-u, --universe <universe>", "Universe name", "local").action(readAction(func, contractName));
  } else {
    subCmd
      .option("-u, --universe <universe>", "Universe name", "local")
      .option("-a, --account <account>", "Account address to use for the transaction")
      .option("-k, --private-key <key>", "Private key to sign the transaction")
      .option("-p, --password [password]", "Password to decrypt the private key")
      .option("-f, --password-file <file>", "File containing the password to decrypt the private key")
      .action(writeAction(func, contractName));
  }

  return subCmd;
}

function preprocessArgs(raw: any[], func: ContractFunction): any[] {
  return raw.map((arg, index) => {
    const paramInfo = func.inputs[index];
    const t = paramInfo?.type;
    const arg2 = t === "address" || t.startsWith("bytes") || t === "string" ? arg : JSON5.parse(arg);
    try {
      // console.log(arg2);
      encodeAbiParameters([paramInfo], [arg2]);
    } catch (e: any) {
      console.log(formatAbiParameter(paramInfo));
      throw new Error(`invalid param ${paramInfo.name}(${paramInfo.internalType}): ${e.message}`);
    }
    return arg2;
  });
}

function writeAction(func: ContractFunction, contractName: string): (this: Command) => Promise<void> {
  return async function read(this: Command) {
    const opts = this.opts();
    const config: UniverseConfig = getUniverseConfig(opts);
    const args = preprocessArgs(this.args, func);
    const publicClient = getPublicClient(config);
    const walletClient = getWalletClient(config, opts);
    const contractAddress = getContractAddress(config, contractName, args);
    console.log({ contractAddress, args, opts, config });
    try {
      const { request } = await publicClient.simulateContract({
        address: contractAddress,
        abi: [func],
        functionName: func.name,
        args: args as any[],
        account: walletClient.account,
      });
      const hash = await walletClient.writeContract(request);
      console.log(`Transaction sent: ${hash}`);
      console.log("Waiting for transaction to be mined...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log("Transaction mined:", receipt);
    } catch (err: any) {
      if (err instanceof BaseError) {
        const revertError = err.walk((err) => err instanceof ContractFunctionRevertedError);
        console.log(revertError);
        if (revertError instanceof ContractFunctionRevertedError) {
          const errorName = revertError.data?.errorName ?? "";
          // do something with `errorName`
        }
      }
    }
  };
}

function readAction(func: ContractFunction, contractName: string): (this: Command) => Promise<void> {
  return async function read(this: Command) {
    const opts = this.opts();
    const config: UniverseConfig = getUniverseConfig(opts);
    const publicClient = getPublicClient(config);
    const args = preprocessArgs(this.args, func);
    const contractAddress = getContractAddress(config, contractName, args);

    try {
      console.log({ contractAddress, args, opts, config });
      console.log(`Calling view function on ${func.name}...`);
      const result = await publicClient.readContract({
        address: contractAddress,
        abi: [func],
        functionName: func.name,
        args: args as any[],
      });
      console.log(`Result:`, result);
    } catch (error) {
      console.error(`Error executing function:`, error);
      process.exit(1);
    }
  };
}
