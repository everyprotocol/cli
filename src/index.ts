#!/usr/bin/env bun
import { Command } from "commander";
import { configureCommandsFromAbi, processAbi, generateCommandFromDetail, ContractFunctionDetail } from "./autocmd";
import path from "path";
import fs from "fs";

// Create the main program
const program = new Command()
  .name("every-cli")
  .description("CLI for interacting with Every Protocol contracts")
  .version("0.1.0");

/**
 * Configures a level 1 subcommand with filtered functions from an ABI file
 * @param program - The commander program to configure
 * @param name - The name of the level 1 command
 * @param abiFile - Path to the ABI file
 * @param filter - Function to filter which functions to include
 * @param level2Namer - Function to convert function names to level 2 command names
 * @returns The configured program
 */
function configureSubCommand(
  program: Command,
  name: string,
  abiFile: string,
  rename: (func: string) => string = (func) => func,
  filter: (func: ContractFunctionDetail) => boolean = (func) => true
): Command {
  try {
    const abiPath = path.resolve(process.cwd(), "abis", abiFile);
    const abiContent = fs.readFileSync(abiPath, "utf8");
    const abi = JSON.parse(abiContent);
    const contractName = path.basename(abiFile, path.extname(abiFile));
    const functionDetails = processAbi(abi, contractName);
    const filteredFunctions = functionDetails.filter(filter);
    const level1Command = program.command(name).description(`${name} commands for ${contractName}`);
    filteredFunctions.forEach((func) => {
      generateCommandFromDetail(level1Command, func);
    });
    return program;
  } catch (error) {
    console.error(`Error configuring subcommand ${name} from ${abiFile}:`, error);
    return program;
  }
}

// Example of using the configureSubCommand function
configureSubCommand(
  program,
  "unique",
  "IElementRegistry.json",
  (func) => func.substring("unique".length),
  (func) => func.name.startsWith("unique")
);
configureSubCommand(
  program,
  "value",
  "IElementRegistry.json",
  (func) => func.substring("value".length),
  (func) => func.name.startsWith("value")
);
configureSubCommand(program, "set", "ISetRegistry.json", (func) => func.substring("set".length));
configureSubCommand(program, "kind", "IKindRegistry.json", (func) => func.substring("kind".length));

// // Example of configuring commands from an ABI file
// // You would replace this with actual ABI paths
// const abiDir = path.resolve(process.cwd(), "abis");
// const abiFiles = [
//   "IRemoteMintable.json",
//   "IObjectMinter.json",
//   "IOmniRegistry.json",
//   "ISetRegistry.json",
//   "IKindRegistry.json",
// ];

// // Configure commands from each ABI file
// abiFiles.forEach((abiFile) => {
//   const abiPath = path.join(abiDir, abiFile);
//   configureCommandsFromAbi(program, abiPath);
// });

// Parse command line arguments
program.parse();

// If no arguments provided, show help
if (process.argv.length <= 2) {
  program.help();
}
