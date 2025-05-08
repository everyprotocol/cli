import { Command } from "commander";
import fs from "fs";
import path from "path";

/**
 * Extracts NatSpec documentation from ABI
 * @param abi - The ABI object
 * @returns Object containing method and event documentation
 */
function extractNatSpec(abi: any) {
  // Check if metadata exists
  if (!abi.metadata) {
    return { methods: {}, events: {} };
  }
  
  try {
    // Parse metadata if it's a string
    const metadata = typeof abi.metadata === 'string' 
      ? JSON.parse(abi.metadata) 
      : abi.metadata;
    
    // Extract documentation
    const devdoc = metadata.output?.devdoc || {};
    const userdoc = metadata.output?.userdoc || {};
    
    return {
      title: devdoc.title || userdoc.notice || '',
      methods: {
        ...devdoc.methods,
        ...userdoc.methods
      },
      events: {
        ...devdoc.events,
        ...userdoc.events
      }
    };
  } catch (error) {
    console.error("Error parsing NatSpec metadata:", error);
    return { methods: {}, events: {} };
  }
}

/**
 * Generates a commander command from a Solidity function definition
 * @param program - The commander program to add the command to
 * @param abiFunction - The function definition from the ABI
 * @param contractName - Optional name of the contract for command grouping
 * @param natspec - NatSpec documentation
 */
export function generateCommandFromAbiFunction(
  program: Command, 
  abiFunction: any, 
  contractName: string,
  natspec: any
): void {
  // Skip if not a function
  if (abiFunction.type !== "function") {
    return;
  }

  const functionName = abiFunction.name;
  
  // Get function documentation
  const functionKey = `${functionName}(${abiFunction.inputs.map((i: any) => i.type).join(',')})`;
  const methodDocs = natspec.methods[functionKey] || {};
  
  // Get user-friendly description
  const functionDescription = methodDocs.notice || `Call ${functionName} function`;
  
  // Create nested command structure
  // Find or create contract subcommand
  let contractCommand = program.commands.find(cmd => cmd.name() === contractName);
  if (!contractCommand) {
    contractCommand = program.command(contractName)
      .description(`Commands for ${contractName} contract`);
  }
  
  // Split function name into parts for nested commands (e.g., "uniqueDescriptor" -> "unique descriptor")
  const parts = functionName.replace(/([A-Z])/g, ' $1').trim().toLowerCase().split(' ');
  
  // Create or find nested command structure
  let currentCommand = contractCommand;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    let subCommand = currentCommand.commands.find(cmd => cmd.name() === part);
    if (!subCommand) {
      subCommand = currentCommand.command(part)
        .description(`${part} commands`);
    }
    currentCommand = subCommand;
  }
  
  // Create the final command with the last part of the function name
  const lastPart = parts[parts.length - 1];
  const command = currentCommand.command(lastPart)
    .description(functionDescription);

  // Add arguments for each input parameter
  abiFunction.inputs.forEach((input: any, index: number) => {
    const paramDocs = methodDocs.params?.[input.name] || `${input.type} parameter`;
    command.argument(`<${input.name}>`, paramDocs);
  });

  // Set the action handler
  command.action((...args) => {
    // Last argument is the Command object
    const options = args.pop();
    // Extract the actual arguments
    const functionArgs = args;
    
    console.log(`Executing ${functionName} with args:`, functionArgs);
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

    // Extract NatSpec documentation
    const natspec = extractNatSpec(abi);

    // Generate commands for each function in the ABI
    abiArray.forEach((item: any) => {
      if (item.type === "function") {
        generateCommandFromAbiFunction(program, item, contractName, natspec);
      }
    });

    return program;
  } catch (error) {
    console.error(`Error processing ABI file ${abiPath}:`, error);
    return program;
  }
}
