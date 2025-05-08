import { Command, type OptionValues } from "commander";
import fs from "fs";
import path from "path";
import { createPublicClient, http, parseAbi, getContract, type PublicClient, type Address } from "viem";
import dotenv from "dotenv";
import { parse as parseTOML } from "@iarna/toml";
import os from "os";
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
  const universes = loadUniverseConfigs();
  const defaultUniverse = universes.size > 0 ? Array.from(universes.keys())[0] : undefined;
  leafCommand.option("-u, --universe <universe>", "Universe URL or name", defaultUniverse);

  // Add additional options for write functions
  if (!isViewFunction) {
    leafCommand
      .option("-a, --account <address>", "Account address to use for the transaction")
      .option("--private-key <key>", "Private key to sign the transaction")
      .option("-p, --password [password]", "Password to decrypt the private key")
      .option("--password-file <file>", "File containing the password to decrypt the private key");
  }

  // Set the action handler
  leafCommand.action(async function () {
    const options = this.opts();
    const functionArgs = this.args;

    // Validate options for write functions
    if (!isViewFunction) {
      if (!options.account && !options.privateKey) {
        console.error("Error: Either --account (-a) or --private-key (-k) must be provided for write functions");
        process.exit(1);
      }
    }

    console.log(`Executing ${functionDetail.name} with args:`, functionArgs);

    try {
      if (isViewFunction) {
        // For view functions, use callFunction
        console.log(`Calling view function on ${functionDetail.contractName}...`);
        const result = await callFunction(functionDetail, functionArgs, options);
        console.log(`Result:`, result);
      } else {
        // For write functions (to be implemented)
        console.log(`Write function execution not yet implemented`);
        console.log(`Options:`, options);
      }
    } catch (error) {
      console.error(`Error executing function:`, error);
      process.exit(1);
    }
  });

  return leafCommand;
}

/**
 * Interface for universe configuration
 */
interface UniverseConfig {
  name: string;
  rpcUrl: string;
  contracts: Record<string, string>; // contractName -> address
}

/**
 * Interface for the complete configuration
 */
interface EveryConfig {
  general: {
    defaultUniverse: string;
  };
  universes: Record<
    string,
    {
      name: string;
      rpc_url: string;
      contracts: Record<string, string>;
    }
  >;
}

// Cache for universe configs to avoid repeated loading
let universeConfigsCache: Map<string, UniverseConfig> | null = null;

/**
 * Load universe configurations from config files and environment
 * @returns Map of universe configurations
 */
function loadUniverseConfigs(): Map<string, UniverseConfig> {
  // Return cached config if available
  if (universeConfigsCache) {
    return universeConfigsCache;
  }

  // Load environment variables from .env file if it exists
  dotenv.config();

  const configs = new Map<string, UniverseConfig>();
  let configData: EveryConfig | null = null;

  // Define possible config file locations in order of precedence
  const configLocations = [
    path.resolve(process.cwd(), ".every.toml"), // Current directory
    path.resolve(os.homedir(), ".every.toml"), // User's home directory
    path.resolve(process.cwd(), "node_modules/every-cli/.every.toml"), // Package default
  ];

  // Try to load from config files in order of precedence
  for (const configPath of configLocations) {
    if (fs.existsSync(configPath)) {
      try {
        const configContent = fs.readFileSync(configPath, "utf8");
        const parsedConfig = parseTOML(configContent) as any;

        // If we already have a config, merge this one into it
        if (configData) {
          // Merge universes
          if (parsedConfig.universes) {
            configData.universes = {
              ...configData.universes,
              ...parsedConfig.universes,
            };
          }

          // Override general settings
          if (parsedConfig.general) {
            configData.general = {
              ...configData.general,
              ...parsedConfig.general,
            };
          }
        } else {
          // First config found, use it as base
          configData = {
            general: {
              defaultUniverse: parsedConfig.general?.default_universe || "mainnet",
            },
            universes: parsedConfig.universes || {},
          };
        }

        console.log(`Loaded configuration from ${configPath}`);
      } catch (error) {
        console.warn(`Failed to load ${configPath}:`, error);
      }
    }
  }

  // Also try to load from legacy config.json for backward compatibility
  try {
    const jsonConfigPath = path.resolve(process.cwd(), "config.json");
    if (fs.existsSync(jsonConfigPath)) {
      const jsonConfig = JSON.parse(fs.readFileSync(jsonConfigPath, "utf8"));

      // If we don't have a config yet, create one
      if (!configData) {
        configData = {
          general: { defaultUniverse: "mainnet" },
          universes: {},
        };
      }

      // Add universes from JSON config
      if (jsonConfig.universes) {
        for (const [name, universe] of Object.entries(jsonConfig.universes)) {
          const u = universe as any;
          configData.universes[name] = {
            name: u.name,
            rpc_url: u.rpcUrl,
            contracts: u.contracts || {},
          };
        }
      }

      console.log(`Loaded configuration from ${jsonConfigPath}`);
    }
  } catch (error) {
    console.warn("Failed to load config.json:", error);
  }

  // Process the loaded configuration
  if (configData && configData.universes) {
    for (const [name, universe] of Object.entries(configData.universes)) {
      configs.set(name, {
        name: universe.name,
        rpcUrl: universe.rpc_url,
        contracts: universe.contracts || {},
      });
    }
  }

  // Add environment-based configuration if available (highest precedence)
  const envUniverseName = process.env.UNIVERSE_NAME;
  const envRpcUrl = process.env.RPC_URL;

  if (envUniverseName && envRpcUrl) {
    // Extract contract addresses from environment variables
    // Format: CONTRACT_ADDRESS_<CONTRACT_NAME>=0x...
    const contracts: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith("CONTRACT_ADDRESS_") && value) {
        const contractName = key.replace("CONTRACT_ADDRESS_", "");
        contracts[contractName] = value;
      }
    }

    configs.set(envUniverseName, {
      name: envUniverseName,
      rpcUrl: envRpcUrl,
      contracts,
    });

    console.log(`Added environment-based configuration for universe "${envUniverseName}"`);
  }

  if (configs.size === 0) {
    console.warn("No universe configurations found. Please create a .every.toml file.");
  }

  // Cache the configs for future use
  universeConfigsCache = configs;
  return configs;
}

/**
 * Get a public client for the specified universe
 * @param universeName - Name of the universe to connect to
 * @returns Public client instance
 */
function getPublicClient(universeName: string): PublicClient {
  const universes = loadUniverseConfigs();
  const universe = universes.get(universeName);

  if (!universe) {
    throw new Error(`Universe "${universeName}" not found in configuration`);
  }

  return createPublicClient({
    transport: http(universe.rpcUrl),
  });
}

/**
 * Call a view function on a contract
 * @param functionDetail - Details of the function to call
 * @param args - Arguments to pass to the function
 * @param options - Command options including universe
 * @returns Promise resolving to the function result
 */
async function callFunction(functionDetail: ContractFunctionDetail, args: any[], options: any): Promise<any> {
  const universeName = options.universe;
  if (!universeName) {
    throw new Error("Universe option is required (--universe, -u)");
  }

  // Load universe configuration
  const universes = loadUniverseConfigs();
  const universe = universes.get(universeName);

  if (!universe) {
    throw new Error(`Universe "${universeName}" not found in configuration`);
  }

  // Get contract address
  // Convert contract name to config key format (e.g., IKindRegistry -> kind_registry)
  const contractKey = functionDetail.contractName
    .replace(/^I/, "") // Remove leading 'I' if present
    .replace(/([A-Z])/g, "_$1") // Add underscore before capital letters
    .toLowerCase() // Convert to lowercase
    .replace(/^_/, ""); // Remove leading underscore if present

  const rawContractAddress = universe.contracts[contractKey] || universe.contracts[functionDetail.contractName];
  if (!rawContractAddress) {
    throw new Error(
      `Contract "${functionDetail.contractName}" (key: ${contractKey}) not found in universe "${universeName}"`
    );
  }
  
  // Ensure the address is properly formatted as a hex string
  const contractAddress = typeof rawContractAddress === 'string' 
    ? rawContractAddress.startsWith('0x') 
      ? rawContractAddress 
      : `0x${rawContractAddress}`
    : `0x${rawContractAddress.toString(16)}`;

  // Create public client
  const publicClient = getPublicClient(universeName);

  // Create contract instance with the full ABI function
  const contract = getContract({
    address: contractAddress as Address,
    abi: parseAbi([`function ${functionDetail.signature}`]),
    publicClient,
  });

  try {
    console.log({ args, options, contractKey, contractAddress, sig: functionDetail.signature });
    // Call the function directly using publicClient.readContract
    const result = await publicClient.readContract({
      address: contractAddress as Address,
      abi: parseAbi([`function ${functionDetail.signature}`]),
      functionName: functionDetail.name,
      args: args as any[],
    });
    return result;
  } catch (error) {
    console.error(`Error calling ${functionDetail.name}:`, error);
    throw error;
  }
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
