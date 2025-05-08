import { Command, type OptionValues } from "commander";
import fs from "fs";
import path from "path";
import { toFunctionSignature } from "viem";
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
      let num: number = level2Cmds.get(func.name) || 0;
      const level2CmdName = num > 0 ? `${func.name}${num + 1}` : func.name;
      level2Cmds.set(func.name, num + 1);
      generateFunctionCommand(level1Cmd, level2CmdName, func);
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
      const userdoc = abi.metdata.output.userdoc.methods[signature] || {};
      const devdoc = abi.metdata.output.devdoc.methods[signature] || {};
      return { ...func, _metadata: { signature, ...userdoc, ...devdoc } } as ContractFunction;
    });
}

export function generateFunctionCommand(cmd: Command, name: string, func: ContractFunction): Command {
  let desc = func._metadata?.notice || `Call ${func.name} function`;
  const subCmd = cmd.command(name).description(desc);
  func.inputs.forEach((input) => {
    const paramDesc = func._metadata?.params?.[input.name] || `${input.type} parameter`;
    subCmd.argument(`<${input.name}>`, paramDesc);
  });
  const isReadFunction = func.stateMutability === "view" || func.stateMutability === "pure";
  if (isReadFunction) {
    subCmd.option("-u, --universe <universe>", "Universe name").action(readAction(func));
  } else {
    subCmd
      .option("-u, --universe <universe>", "Universe name")
      .option("-a, --account <address>", "Account address to use for the transaction")
      .option("--pk, --private-key <key>", "Private key to sign the transaction")
      .option("-p, --password [password]", "Password to decrypt the private key")
      .option("--pf, --password-file <file>", "File containing the password to decrypt the private key")
      .action(writeAction(func));
  }

  return subCmd;
}

function preprocessArgs(raw: any[], func: ContractFunction): any[] {}

function writeAction(func: ContractFunction): (this: Command) => Promise<void> {
  return async function read(this: Command) {
    const opts = this.opts();
    const config: UniverseConfig = getUniverseConfig(opts);
    const args = preprocessArgs(this.args, func);
    const publicClient = getPublicClient(config);
    const walletClient = getWalletClient(config, opts, args);
    const contractAddress = getContractAddress(config, "contract", args);

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

function readAction(func: ContractFunction): (this: Command) => Promise<void> {
  return async function read(this: Command) {
    const opts = this.opts();
    const config: UniverseConfig = getUniverseConfig(opts);
    const publicClient = getPublicClient(config);
    const args = preprocessArgs(this.args, func);
    const contractAddress = getContractAddress(config, "contract", args);

    try {
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

  // // Process arguments to handle arrays and other complex types
  // const functionArgs = rawArgs.map((arg: string, index: number) => {
  //   const paramType = func.inputs[index]?.type;

  //   // Handle array types
  //   if (paramType && (paramType.endsWith("[]") || paramType.includes("["))) {
  //     try {
  //       // Parse JSON string to array
  //       return JSON.parse(arg);
  //     } catch (e) {
  //       console.error(`Error parsing array argument: ${arg}`);
  //       throw new Error(`Could not parse argument ${index + 1} as array. Please provide a valid JSON array.`);
  //     }
  //   }

  //   // Handle bytes32 type (ensure proper length)
  //   if (paramType === "bytes32" && arg.startsWith("0x") && arg.length < 66) {
  //     // Pad to full bytes32 length
  //     return arg.padEnd(66, "0");
  //   }

  //   return arg;
  // });
  // if (!options.account && !options.privateKey) {
  //   console.error("Error: Either --account (-a) or --private-key must be provided for write functions");
  //   process.exit(1);
  // }
  // console.log(`Executing ${func.name} with args:`, functionArgs);
  // try {
  //   console.log(`Calling view function on ${func.name}...`);
  //   const result = await executeContractFunction(func, functionArgs, options);
  //   console.log(`Result:`, result);
  // } catch (error) {
  //   console.error(`Error executing function:`, error);
  //   process.exit(1);
  // }
}

// // Removed duplicate interface definitions - now imported from types.ts

// // Import loadUniverseConfigs from config.ts instead of duplicating it
// import { loadUniverseConfigs } from "./config";

// // Import client functions from client.ts

// export function generateCommandFromAbiFunction(
//   program: Command,
//   abiFunction: any,
//   contractName: string,
//   natspec: any
// ): void {
//   // Skip if not a function
//   if (abiFunction.type !== "function") {
//     return;
//   }

//   // Create function detail
//   const functionDetail = processAbi(
//     { abi: [abiFunction], metadata: { output: { devdoc: {}, userdoc: {} } } },
//     contractName
//   )[0];

//   // Override with natspec if available
//   const functionKey = functionDetail.signature;
//   const methodDocs = natspec.methods[functionKey] || {};
//   functionDetail.description = methodDocs.notice || functionDetail.description;

//   functionDetail.inputs.forEach((input) => {
//     input.description = methodDocs.params?.[input.name] || input.description;
//   });

//   // Create nested command structure
//   // Find or create contract subcommand
//   let contractCommand = program.commands.find((cmd) => cmd.name() === contractName);
//   if (!contractCommand) {
//     contractCommand = program.command(contractName).description(`Commands for ${contractName} contract`);
//   }

//   // Create or find nested command structure
//   let currentCommand = contractCommand;
//   for (let i = 0; i < functionDetail.commandPath.length - 1; i++) {
//     const part = functionDetail.commandPath[i];
//     let subCommand = currentCommand.commands.find((cmd) => cmd.name() === part);
//     if (!subCommand) {
//       subCommand = currentCommand.command(part).description(`${part} commands`);
//     }
//     currentCommand = subCommand;
//   }

//   // Generate the leaf command
//   generateCommandFromDetail(currentCommand, functionDetail);
// }

/**
 * Configures a commander program with commands from an ABI file
 * @param program - The commander program to configure
 * @param abiPath - Path to the ABI file
 * @returns The configured program
 */
// export function configureCommandsFromAbi(program: Command, abiPath: string): Command {
//   try {
//     // Read and parse the ABI file
//     const abiContent = fs.readFileSync(path.resolve(abiPath), "utf8");
//     const abi = JSON.parse(abiContent);

//     // Extract contract name from file path
//     const contractName = path.basename(abiPath, path.extname(abiPath));

//     // Process the ABI to get function details
//     const functionDetails = processAbi(abi);

//     // Group functions by their first command path segment to avoid duplicates
//     const groupedFunctions = functionDetails.reduce((acc: Record<string, ContractFunctionDetail[]>, func) => {
//       const firstSegment = func.commandPath[0];
//       if (!acc[firstSegment]) {
//         acc[firstSegment] = [];
//       }
//       acc[firstSegment].push(func);
//       return acc;
//     }, {});

//     // Create contract command
//     let contractCommand = program.commands.find((cmd) => cmd.name() === contractName);
//     if (!contractCommand) {
//       contractCommand = program.command(contractName).description(`Commands for ${contractName} contract`);
//     }

//     // Process each function group
//     Object.entries(groupedFunctions).forEach(([firstSegment, funcs]) => {
//       // Create first level subcommand
//       let subCommand = contractCommand.commands.find((cmd) => cmd.name() === firstSegment);
//       if (!subCommand) {
//         subCommand = contractCommand.command(firstSegment).description(`${firstSegment} commands`);
//       }

//       // Process each function in the group
//       funcs.forEach((func) => {
//         // Create nested command structure
//         let currentCommand = subCommand;
//         for (let i = 1; i < func.commandPath.length - 1; i++) {
//           const part = func.commandPath[i];
//           let nextCommand = currentCommand.commands.find((cmd) => cmd.name() === part);
//           if (!nextCommand) {
//             nextCommand = currentCommand.command(part).description(`${part} commands`);
//           }
//           currentCommand = nextCommand;
//         }

//         // Generate the leaf command
//         generateCommandFromDetail(currentCommand, func);
//       });
//     });

//     return program;
//   } catch (error) {
//     console.error(`Error processing ABI file ${abiPath}:`, error);
//     return program;
//   }
// }
