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
  filter: (func: ContractFunctionDetail) => boolean,
  level2Namer: (func: ContractFunctionDetail) => string
): Command {
  try {
    // Read and parse the ABI file
    const abiPath = path.resolve(process.cwd(), "abis", abiFile);
    const abiContent = fs.readFileSync(abiPath, "utf8");
    const abi = JSON.parse(abiContent);

    // Extract contract name from file path
    const contractName = path.basename(abiFile, path.extname(abiFile));

    // Process the ABI to get function details
    const functionDetails = processAbi(abi, contractName);
    
    // Filter functions based on the provided filter function
    const filteredFunctions = functionDetails.filter(filter);
    
    // Create the level 1 command
    const level1Command = program.command(name)
      .description(`${name} commands for ${contractName}`);
    
    // Group functions by the custom level 2 naming function
    const groupedFunctions = filteredFunctions.reduce((acc: Record<string, ContractFunctionDetail[]>, func) => {
      const level2Name = level2Namer(func);
      if (!acc[level2Name]) {
        acc[level2Name] = [];
      }
      acc[level2Name].push(func);
      return acc;
    }, {});
    
    // Create level 2 commands
    Object.entries(groupedFunctions).forEach(([level2Name, funcs]) => {
      const level2Command = level1Command.command(level2Name)
        .description(`${level2Name} commands`);
      
      // Generate leaf commands for each function
      funcs.forEach(func => {
        generateCommandFromDetail(level2Command, func);
      });
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
  "element",
  "IElementRegistry.json",
  (func) => func.name.startsWith("unique") || func.name.startsWith("value"),
  (func) => {
    // Group by the first word (unique/value)
    return func.name.startsWith("unique") ? "unique" : "value";
  }
);

// Example of configuring commands from an ABI file
// You would replace this with actual ABI paths
const abiDir = path.resolve(process.cwd(), "abis");
const abiFiles = [
  "IRemoteMintable.json",
  "IObjectMinter.json",
  "IOmniRegistry.json",
  "ISetRegistry.json",
  "IKindRegistry.json",
];

// Configure commands from each ABI file
abiFiles.forEach((abiFile) => {
  const abiPath = path.join(abiDir, abiFile);
  configureCommandsFromAbi(program, abiPath);
});

// Parse command line arguments
program.parse();

// If no arguments provided, show help
if (process.argv.length <= 2) {
  program.help();
}
