import { Command, type OptionValues } from "commander";
import fs from "fs";
import path from "path";
import { toFunctionSignature } from "viem";
import { SolidityAddress } from "abitype";
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
    const functionDetails = extractFunctions(abi);
    const filtered = filter ? functionDetails.filter(filter) : functionDetails;

    const level1Cmd = program.command(name).description(`${name} commands for ${contractName}`);
    const level2Cmds = new Map<string, number>();
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
  return abi.abi
    .filter((item: any) => item.type === "function")
    .map((func: any) => {
      const signature = toFunctionSignature(func);
      // Handle case where metadata might not exist or have expected structure
      const metadata = abi.metadata?.output || { userdoc: { methods: {} }, devdoc: { methods: {} } };
      const userdoc = metadata.userdoc?.methods?.[signature] || {};
      const devdoc = metadata.devdoc?.methods?.[signature] || {};
      return { ...func, _metadata: { signature, ...userdoc, ...devdoc } } as ContractFunction;
    });
}

export function generateFunctionCommand(
  cmd: Command,
  name: string,
  func: ContractFunction,
  contractName: string
): Command {
  let desc = func._metadata?.notice || `Call ${func.name} function`;
  const subCmd = cmd.command(name).description(desc);
  func.inputs.forEach((input) => {
    const paramDesc = func._metadata?.params?.[input.name] || `${input.type} parameter`;
    subCmd.argument(`<${input.name}>`, paramDesc);
  });
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

// ai! update this function
// 1. if paramType == "address" treate it as bytes20
// 2. if paramType is bytes or bytesN, it should start with 0x and with matched length
// 3. if paramType == string, keep as it is
// 4. else parse with json5
function preprocessArgs(raw: any[], func: ContractFunction): any[] {
  return raw.map((arg, index) => {
    const paramType = func.inputs[index]?.type;
    if (paramType && (paramType.endsWith("[]") || paramType.includes("["))) {
      try {
        return JSON.parse(arg);
      } catch (e) {
        console.error(`Error parsing array argument: ${arg}`);
        throw new Error(`Could not parse argument ${index + 1} as array. Please provide a valid JSON array.`);
      }
    }

    // Handle bytes32 type
    if (paramType === "bytes32" && arg.startsWith("0x") && arg.length < 66) {
      return arg.padEnd(66, "0");
    }

    return arg;
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
