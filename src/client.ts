import { 
  createPublicClient, 
  http, 
  parseAbi, 
  getContract, 
  createWalletClient,
  type PublicClient, 
  type Address 
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import path from "path";
import { loadUniverseConfigs } from "./config";
import type { ContractFunctionDetail } from "./autocmd";

/**
 * Get a public client for the specified universe
 * @param universeName - Name of the universe to connect to
 * @returns Public client instance
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
 * Send a transaction to a contract (for non-view functions)
 * @param functionDetail - Details of the function to call
 * @param args - Arguments to pass to the function
 * @param options - Command options including universe and account details
 * @returns Promise resolving to the transaction hash
 */
export async function sendTransaction(functionDetail: ContractFunctionDetail, args: any[], options: any): Promise<string> {
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
  const contractAddress =
    typeof rawContractAddress === "string"
      ? rawContractAddress.startsWith("0x")
        ? rawContractAddress
        : `0x${rawContractAddress}`
      : `0x${rawContractAddress.toString(16)}`;

  // Create public client
  const publicClient = getPublicClient(universeName);

  // Validate account information
  if (!options.account && !options.privateKey) {
    throw new Error("Either --account (-a) or --private-key must be provided for write functions");
  }

  // Create wallet client based on provided options
  let walletClient;
  
  if (options.privateKey) {
    // Use private key if provided
    const privateKey = options.privateKey.startsWith("0x") 
      ? options.privateKey 
      : `0x${options.privateKey}`;
      
    walletClient = createWalletClient({
      account: privateKeyToAccount(privateKey as `0x${string}`),
      chain: publicClient.chain,
      transport: http(universe.rpcUrl),
    });
  } else if (options.account) {
    // Use account address if provided (assumes it's unlocked in the node)
    walletClient = createWalletClient({
      account: options.account as `0x${string}`,
      chain: publicClient.chain,
      transport: http(universe.rpcUrl),
    });
  }

  if (!walletClient) {
    throw new Error("Failed to create wallet client");
  }

  try {
    console.log({ 
      args, 
      options, 
      contractKey, 
      contractAddress, 
      functionName: functionDetail.name 
    });

    // Prepare the transaction
    const { request } = await publicClient.simulateContract({
      address: contractAddress as Address,
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
  } catch (error) {
    console.error(`Error sending transaction to ${functionDetail.name}:`, error);
    throw error;
  }
}

/**
 * Call a view function on a contract
 * @param functionDetail - Details of the function to call
 * @param args - Arguments to pass to the function
 * @param options - Command options including universe
 * @returns Promise resolving to the function result
 */
export async function callFunction(functionDetail: ContractFunctionDetail, args: any[], options: any): Promise<any> {
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
  const contractAddress =
    typeof rawContractAddress === "string"
      ? rawContractAddress.startsWith("0x")
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
    // Call the function directly using publicClient.readContract
    // Handle tuple types specially to avoid abitype errors
    let result;

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

      console.log({ args, options, contractKey, contractAddress, functionName: functionDetail.name });

      // Use the full ABI for the call
      result = await publicClient.readContract({
        address: contractAddress as Address,
        abi: abiFunctions,
        functionName: functionDetail.name,
        args: args as any[],
      });
    } else {
      // For simple return types, use the constructed signature
      const returnTypes = functionDetail.outputs.map((output) => output.type).join(",");
      const fullSignature = `function ${functionDetail.signature} returns (${returnTypes})`;
      console.log({ args, options, contractKey, contractAddress, fullSignature });

      result = await publicClient.readContract({
        address: contractAddress as Address,
        abi: parseAbi([fullSignature]),
        functionName: functionDetail.name,
        args: args as any[],
      });
    }

    console.log(result);
    return result;
  } catch (error) {
    console.error(`Error calling ${functionDetail.name}:`, error);
    throw error;
  }
}
