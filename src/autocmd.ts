import { Command } from "commander";
import fs from "fs";
import path from "path";

// ai!
// 1. use nested subcommands to orgnize commands, e.g., uniqueDescriptor => every-cli unique descriptor [options]
// 2. use arguments instead of options for function args
// 3. get command/argument description from userdoc/devdoc
/**
 * Generates a commander command from a Solidity function definition
 * @param program - The commander program to add the command to
 * @param abiFunction - The function definition from the ABI
 * @param contractName - Optional name of the contract for command grouping
 */
export function generateCommandFromAbiFunction(program: Command, abiFunction: any, contractName?: string): void {
  // Skip if not a function or if it's not an external/public function
  if (abiFunction.type !== "function") {
    return;
  }

  const functionName = abiFunction.name;
  const commandName = contractName ? `${contractName}:${functionName}` : functionName;

  // Create a new command
  const command = program.command(commandName).description(`Call ${functionName} function`);

  // Add options for each input parameter
  abiFunction.inputs.forEach((input: any) => {
    const flagName = `--${input.name}`;
    const description = `${input.type} ${input.name}`;
    command.option(`${flagName} <value>`, description);
  });

  // Set the action handler
  command.action((options) => {
    console.log(`Executing ${functionName} with options:`, options);
    // Here you would add the actual contract call logic
  });
}

/**
 * Configures a commander program with commands from an ABI file
 * @param program - The commander program to configure
 * @param abiPath - Path to the ABI file
 * @returns The configured program
 */
export function configureCommandsFromAbi(program: Command, abiPath: string): Command {
  try {
    // Read and parse the ABI file
    const abiContent = fs.readFileSync(path.resolve(abiPath), "utf8");
    const abi = JSON.parse(abiContent);

    // Extract contract name from file path
    const contractName = path.basename(abiPath, path.extname(abiPath));

    // Get the ABI array (handle both direct array and nested in "abi" property)
    const abiArray = Array.isArray(abi) ? abi : abi.abi;

    if (!abiArray) {
      console.error(`No valid ABI found in ${abiPath}`);
      return program;
    }

    // Generate commands for each function in the ABI
    abiArray.forEach((item: any) => {
      if (item.type === "function") {
        generateCommandFromAbiFunction(program, item, contractName);
      }
    });

    return program;
  } catch (error) {
    console.error(`Error processing ABI file ${abiPath}:`, error);
    return program;
  }
}
