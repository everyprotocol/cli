import { Command } from "commander";
import path from "path";
import fs from "fs";
import { processAbi, generateCommandFromDetail, ContractFunctionDetail } from "./autocmd";
import { CommandConfig } from "./types";

/**
 * Configures a level 1 subcommand with filtered functions from an ABI file
 * @param program - The commander program to configure
 * @param config - Configuration for the command
 * @returns The configured program
 */
export function configureSubCommand(
  program: Command,
  config: CommandConfig
): Command {
  try {
    const { name, abiFile, rename = (func) => func, filter } = config;
    
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
    console.error(`Error configuring subcommand ${config.name} from ${config.abiFile}:`, error);
    return program;
  }
}
