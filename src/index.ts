#!/usr/bin/env bun
import { Command } from "commander";
import { processAbi, generateCommandFromDetail, type ContractFunctionDetail } from "./autocmd";
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

    // Group functions by their command name to avoid duplicates
    const groupedByName = new Map<string, ContractFunctionDetail[]>();

    filteredFunctions.forEach((func) => {
      // Apply the rename function to get the command name
      const baseName = func.name;
      const commandName = func.commandPath[func.commandPath.length - 1];

      if (!groupedByName.has(commandName)) {
        groupedByName.set(commandName, []);
      }
      groupedByName.get(commandName)!.push(func);
    });

    const level1Command = program.command(name).description(`${name} commands for ${contractName}`);

    // Create commands, making them unique if needed
    groupedByName.forEach((funcs, commandName) => {
      if (funcs.length === 1) {
        // Only one function with this name, use it directly
        generateCommandFromDetail(level1Command, funcs[0]);
      } else {
        // Multiple functions with the same name, create a subcommand group
        const subCommand = level1Command.command(commandName).description(`${commandName} operations`);

        // Add each function with a unique suffix based on its signature
        funcs.forEach((func, index) => {
          // Create a modified function detail with a unique command path
          const uniqueFunc = { ...func };

          // Create a unique name based on parameter types
          const paramTypes = func.inputs.map((input) =>
            input.type
              .replace(/\[\]$/, "array")
              .replace(/^uint/, "u")
              .replace(/^bytes/, "b")
          );
          const uniqueName = paramTypes.length > 0 ? `with-${paramTypes.join("-")}` : `variant-${index + 1}`;

          uniqueFunc.commandPath = [...func.commandPath.slice(0, -1), uniqueName];

          generateCommandFromDetail(subCommand, uniqueFunc);
        });
      }
    });
    return program;
  } catch (error) {
    console.error(`Error configuring subcommand ${name} from ${abiFile}:`, error);
    return program;
  }
}

configureSubCommand(program, "kind", "IKindRegistry.json");
configureSubCommand(program, "set", "ISetRegistry.json");
configureSubCommand(
  program,
  "relation",
  "IOmniRegistry.json",
  (func) => func,
  (func) => func.name.startsWith("relation")
);
configureSubCommand(program, "mintpolicy", "IObjectMinter.json", (func) => func);
configureSubCommand(program, "object", "ISet.json", (func) => func);

configureSubCommand(
  program,
  "unique",
  "IElementRegistry.json",
  (func) => func, // Keep original function names
  (func) => func.name.startsWith("unique")
);
configureSubCommand(
  program,
  "value",
  "IElementRegistry.json",
  (func) => func, // Keep original function names
  (func) => func.name.startsWith("value")
);

// Parse command line arguments
program.parse();

// If no arguments provided, show help
if (process.argv.length <= 2) {
  program.help();
}
