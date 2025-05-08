import {
  createPublicClient,
  http,
  parseAbi,
  getContract,
  createWalletClient,
  type PublicClient,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import path from "path";
import { loadUniverseConfigs } from "./config";
import type { ContractFunctionDetail } from "./types";

/**
 * Gets a public client for the specified universe
 */
export function getPublicClient(universeName: string): PublicClient {
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
 * Gets contract address for a given function detail and universe
 */
function getContractAddress(functionDetail: ContractFunctionDetail, universeName: string): Address {
  const universes = loadUniverseConfigs();
  const universe = universes.get(universeName);

  if (!universe) {
    throw new Error(`Universe "${universeName}" not found in configuration`);
  }

  // Convert contract name to config key format (e.g., IKindRegistry -> kind_registry)
  const contractKey = functionDetail.contractName
    .replace(/^I/, "")
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");

  const rawContractAddress = universe.contracts[contractKey] || universe.contracts[functionDetail.contractName];
  if (!rawContractAddress) {
    throw new Error(
      `Contract "${functionDetail.contractName}" (key: ${contractKey}) not found in universe "${universeName}"`
    );
  }

  // Ensure the address is properly formatted as a hex string
  return (typeof rawContractAddress === "string"
    ? rawContractAddress.startsWith("0x")
      ? rawContractAddress
      : `0x${rawContractAddress}`
    : `0x${rawContractAddress.toString(16)}`) as Address;
}

/**
 * Execute a contract function (read or write)
 */
export async function executeContractFunction(
  functionDetail: ContractFunctionDetail,
  args: any[],
  options: any
): Promise<any> {
  const universeName = options.universe;
  if (!universeName) {
    throw new Error("Universe option is required (--universe, -u)");
  }

  const contractAddress = getContractAddress(functionDetail, universeName);
  const publicClient = getPublicClient(universeName);
  const isReadFunction = functionDetail.stateMutability === "view" || functionDetail.stateMutability === "pure";

  console.log({
    args,
    options,
    contractKey: functionDetail.contractName
      .replace(/^I/, "")
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .replace(/^_/, ""),
    contractAddress,
    functionName: functionDetail.name,
  });

  try {
    // Handle read functions
    if (isReadFunction) {
      return await executeReadFunction(functionDetail, args, contractAddress, publicClient);
    }
    // Handle write functions
    else {
      return await executeWriteFunction(functionDetail, args, contractAddress, publicClient, options);
    }
  } catch (error) {
    console.error(`Error executing ${functionDetail.name}:`, error);
    throw error;
  }
}

/**
 * Execute a read-only contract function
 */
async function executeReadFunction(
  functionDetail: ContractFunctionDetail,
  args: any[],
  contractAddress: Address,
  publicClient: PublicClient
): Promise<any> {
  // Check if any output type is a tuple
  const hasTupleOutput = functionDetail.outputs.some(
    (output) => output.type === "tuple" || output.type.includes("tuple[")
  );

  if (hasTupleOutput) {
    // For functions with tuple returns, use the original ABI function
    const abiPath = path.resolve(process.cwd(), "abis", `${functionDetail.contractName}.json`);
    const abiContent = fs.readFileSync(abiPath, "utf8");
    const fullAbi = JSON.parse(abiContent).abi;

    // Find the matching function in the ABI
    const abiFunctions = fullAbi.filter((item: any) => item.type === "function" && item.name === functionDetail.name);

    // Use the full ABI for the call
    return await publicClient.readContract({
      address: contractAddress,
      abi: abiFunctions,
      functionName: functionDetail.name,
      args: args as any[],
    });
  } else {
    // For simple return types, use the constructed signature
    const returnTypes = functionDetail.outputs.map((output) => output.type).join(",");
    const fullSignature = `function ${functionDetail.signature} returns (${returnTypes})`;

    return await publicClient.readContract({
      address: contractAddress,
      abi: parseAbi([fullSignature]),
      functionName: functionDetail.name,
      args: args as any[],
    });
  }
}

/**
 * Execute a write contract function
 */
async function executeWriteFunction(
  functionDetail: ContractFunctionDetail,
  args: any[],
  contractAddress: Address,
  publicClient: PublicClient,
  options: any
): Promise<string> {
  if (!options.account && !options.privateKey) {
    throw new Error("Either --account (-a) or --private-key must be provided for write functions");
  }

  // Get universe for RPC URL
  const universes = loadUniverseConfigs();
  const universe = universes.get(options.universe);
  
  if (!universe) {
    throw new Error(`Universe "${options.universe}" not found in configuration`);
  }

  // Create wallet client
  let walletClient;
  if (options.privateKey) {
    const privateKey = options.privateKey.startsWith("0x") ? options.privateKey : `0x${options.privateKey}`;
    walletClient = createWalletClient({
      account: privateKeyToAccount(privateKey as `0x${string}`),
      chain: publicClient.chain,
      transport: http(universe.rpcUrl),
    });
  } else if (options.account) {
    walletClient = createWalletClient({
      account: options.account as `0x${string}`,
      chain: publicClient.chain,
      transport: http(universe.rpcUrl),
    });
  }

  if (!walletClient) {
    throw new Error("Failed to create wallet client");
  }

  // Prepare the transaction
  const { request } = await publicClient.simulateContract({
    address: contractAddress,
    abi: parseAbi([`function ${functionDetail.signature}`]),
    functionName: functionDetail.name,
    args: args as any[],
    account: walletClient.account,
  });

  // Send the transaction
  const hash = await walletClient.writeContract(request);
  console.log(`Transaction sent: ${hash}`);

  // Wait for transaction to be mined
  console.log("Waiting for transaction to be mined...");
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Transaction mined:", receipt);

  return hash;
}
