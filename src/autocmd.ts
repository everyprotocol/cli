import { Command } from "commander";
import fs from "fs";
import path from "path";

/**
 * Represents a function from a contract ABI with its documentation
 */
export interface ContractFunctionDetail {
  /** Original ABI function object */
  abiFunction: any;
  /** Function name */
  name: string;
  /** Function signature (name + param types) */
  signature: string;
  /** Function inputs */
  inputs: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  /** Function outputs */
  outputs: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  /** Function state mutability (view, pure, nonpayable, payable) */
  stateMutability: string;
  /** User-friendly description of the function */
  description: string;
  /** Contract name this function belongs to */
  contractName: string;
  /** Command path segments for nested commands */
  commandPath: string[];
}

/**
 * Processes an ABI and extracts detailed function information
 * @param abi - The ABI object
 * @param contractName - Name of the contract
 * @returns Array of contract function details
 */
export function processAbi(abi: any, contractName: string): ContractFunctionDetail[] {
  // Extract NatSpec documentation
  const natspec = extractNatSpec(abi);

  // Get the ABI array (handle both direct array and nested in "abi" property)
  const abiArray = Array.isArray(abi) ? abi : abi.abi;

  if (!abiArray) {
    console.error(`No valid ABI found for ${contractName}`);
    return [];
  }

  // Process only functions
  return abiArray
    .filter((item: any) => item.type === "function")
    .map((func: any) => {
      // Create function signature for looking up docs
      const signature = `${func.name}(${func.inputs.map((i: any) => i.type).join(",")})`;

      // Get function documentation
      const methodDocs = natspec.methods[signature] || {};

      // Process inputs with documentation
      const inputs = func.inputs.map((input: any) => ({
        name: input.name,
        type: input.type,
        description: methodDocs.params?.[input.name] || `${input.type} parameter`,
      }));

      // Process outputs with documentation
      const outputs = func.outputs.map((output: any, index: number) => {
        const outputName = output.name || `output${index}`;
        return {
          name: outputName,
          type: output.type,
          description: methodDocs.returns?.[outputName] || `${output.type} return value`,
        };
      });

      // Split function name into parts for nested commands
      const commandPath = func.name
        .replace(/([A-Z])/g, " $1")
        .trim()
        .toLowerCase()
        .split(" ");

      return {
        abiFunction: func,
        name: func.name,
        signature,
        inputs,
        outputs,
        stateMutability: func.stateMutability,
        description: methodDocs.notice || `Call ${func.name} function`,
        contractName,
        commandPath,
      };
    });
}

// ai! add options for contract functions, if it's a view function, add --universe(-u), if it's a write funciton, add --universe(-u), --account(-a), --private-key(-k),  --password(-p) or --password-file(--pf) the password options can be ommited meaning user will input from the terminal, either -a or -k must be present
//

/**
 * Generates a command from a ContractFunctionDetail
 * @param command - The parent command to add to
 * @param functionDetail - The function detail object
 */
export function generateCommandFromDetail(command: Command, functionDetail: ContractFunctionDetail): Command {
  // Get the last part of the command path
  const commandName = functionDetail.commandPath[functionDetail.commandPath.length - 1];

  // Create a more descriptive command description that includes signature info
  let description = functionDetail.description;
  if (functionDetail.inputs.length > 0) {
    const signature = `${functionDetail.name}(${functionDetail.inputs.map((i) => i.type).join(", ")})`;
    description = `${description} [${signature}]`;
  }

  // Create the command
  const leafCommand = command.command(commandName).description(description);

  // Add arguments for each input parameter
  functionDetail.inputs.forEach((input) => {
    leafCommand.argument(`<${input.name}>`, input.description);
  });

  // Add common options based on function type
  const isViewFunction = functionDetail.stateMutability === "view" || functionDetail.stateMutability === "pure";

  // Add universe option for all functions
  leafCommand.option("-u, --universe <universe>", "Universe URL or name");

  // Add additional options for write functions
  if (!isViewFunction) {
    leafCommand
      .option("-a, --account <address>", "Account address to use for the transaction")
      .option("--private-key <key>", "Private key to sign the transaction")
      .option("-p, --password <password>", "Password to decrypt the private key")
      .option("--password-file <file>", "File containing the password to decrypt the private key");
  }

  // Set the action handler
  leafCommand.action((...args) => {
    // Last argument is the Command object
    const options = args.pop();
    // Extract the actual arguments
    const functionArgs = args;

    // Validate options for write functions
    if (!isViewFunction) {
      if (!options.account && !options.privateKey) {
        console.error("Error: Either --account (-a) or --private-key (-k) must be provided for write functions");
        process.exit(1);
      }
    }

    console.log(`Executing ${functionDetail.name} with args:`, functionArgs);
    console.log(`Options:`, options);
    // Here you would add the actual contract call logic
  });

  return leafCommand;
}

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
    const metadata = typeof abi.metadata === "string" ? JSON.parse(abi.metadata) : abi.metadata;

    // Extract documentation
    const devdoc = metadata.output?.devdoc || {};
    const userdoc = metadata.output?.userdoc || {};

    return {
      title: devdoc.title || userdoc.notice || "",

      // Properly merge method documentation from both devdoc and userdoc
      methods: Object.entries(devdoc.methods || {}).reduce(
        (acc, [key, value]) => {
          acc[key] = { ...value };
          if (userdoc.methods && userdoc.methods[key]) {
            // Merge the userdoc properties with devdoc properties
            acc[key] = { ...acc[key], ...userdoc.methods[key] };
          }
          return acc;
        },
        { ...(userdoc.methods || {}) }
      ),

      events: {
        ...devdoc.events,
        ...userdoc.events,
      },
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
 * @param contractName - Name of the contract for command grouping
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

  // Create function detail
  const functionDetail = processAbi(
    { abi: [abiFunction], metadata: { output: { devdoc: {}, userdoc: {} } } },
    contractName
  )[0];

  // Override with natspec if available
  const functionKey = functionDetail.signature;
  const methodDocs = natspec.methods[functionKey] || {};
  functionDetail.description = methodDocs.notice || functionDetail.description;

  functionDetail.inputs.forEach((input) => {
    input.description = methodDocs.params?.[input.name] || input.description;
  });

  // Create nested command structure
  // Find or create contract subcommand
  let contractCommand = program.commands.find((cmd) => cmd.name() === contractName);
  if (!contractCommand) {
    contractCommand = program.command(contractName).description(`Commands for ${contractName} contract`);
  }

  // Create or find nested command structure
  let currentCommand = contractCommand;
  for (let i = 0; i < functionDetail.commandPath.length - 1; i++) {
    const part = functionDetail.commandPath[i];
    let subCommand = currentCommand.commands.find((cmd) => cmd.name() === part);
    if (!subCommand) {
      subCommand = currentCommand.command(part).description(`${part} commands`);
    }
    currentCommand = subCommand;
  }

  // Generate the leaf command
  generateCommandFromDetail(currentCommand, functionDetail);
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

    // Extract NatSpec documentation
    const natspec = extractNatSpec(abi);

    // Process the ABI to get function details
    const functionDetails = processAbi(abi, contractName);

    // Group functions by their first command path segment to avoid duplicates
    const groupedFunctions = functionDetails.reduce((acc: Record<string, ContractFunctionDetail[]>, func) => {
      const firstSegment = func.commandPath[0];
      if (!acc[firstSegment]) {
        acc[firstSegment] = [];
      }
      acc[firstSegment].push(func);
      return acc;
    }, {});

    // Create contract command
    let contractCommand = program.commands.find((cmd) => cmd.name() === contractName);
    if (!contractCommand) {
      contractCommand = program.command(contractName).description(`Commands for ${contractName} contract`);
    }

    // Process each function group
    Object.entries(groupedFunctions).forEach(([firstSegment, funcs]) => {
      // Create first level subcommand
      let subCommand = contractCommand.commands.find((cmd) => cmd.name() === firstSegment);
      if (!subCommand) {
        subCommand = contractCommand.command(firstSegment).description(`${firstSegment} commands`);
      }

      // Process each function in the group
      funcs.forEach((func) => {
        // Create nested command structure
        let currentCommand = subCommand;
        for (let i = 1; i < func.commandPath.length - 1; i++) {
          const part = func.commandPath[i];
          let nextCommand = currentCommand.commands.find((cmd) => cmd.name() === part);
          if (!nextCommand) {
            nextCommand = currentCommand.command(part).description(`${part} commands`);
          }
          currentCommand = nextCommand;
        }

        // Generate the leaf command
        generateCommandFromDetail(currentCommand, func);
      });
    });

    return program;
  } catch (error) {
    console.error(`Error processing ABI file ${abiPath}:`, error);
    return program;
  }
}
