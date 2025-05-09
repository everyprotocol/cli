import { Address, SolidityTuple } from "abitype/zod";
import { AbiParameterToPrimitiveType, AbiTypeToPrimitiveType, parseAbi } from "abitype";
import fs from "fs";
import path from "path";

/**
 * Extract all distinct types from ABI files
 * @param abiDir Directory containing ABI files
 * @returns Object with native and user-defined types
 */
export function extractDistinctTypes(abiDir: string = path.resolve(process.cwd(), "abis")) {
  const nativeTypes = new Set<string>();
  const userDefinedTypes = new Set<string>();

  if (!fs.existsSync(abiDir)) {
    console.warn(`ABI directory not found: ${abiDir}`);
    return { nativeTypes: [], userDefinedTypes: [] };
  }

  const files = fs.readdirSync(abiDir).filter((file) => file.endsWith(".json"));

  for (const file of files) {
    try {
      const abiPath = path.join(abiDir, file);
      const abiContent = fs.readFileSync(abiPath, "utf8");
      const abi = JSON.parse(abiContent);

      // Process ABI items
      for (const item of abi.abi || []) {
        // Extract types from function inputs and outputs
        if (item.type === "function" || item.type === "event") {
          // Process inputs
          for (const input of item.inputs || []) {
            processType(input.type);
            processInternalType(input.internalType);

            // Handle tuple components recursively
            if (input.components) {
              for (const component of input.components) {
                processType(component.type);
                processInternalType(component.internalType);
              }
            }
          }

          // Process outputs for functions
          if (item.type === "function") {
            for (const output of item.outputs || []) {
              processType(output.type);
              processInternalType(output.internalType);

              // Handle tuple components recursively
              if (output.components) {
                for (const component of output.components) {
                  processType(component.type);
                  processInternalType(component.internalType);
                }
              }
            }
          }
        }

        // Also check for custom types in the ABI
        if (item.type === "error" || item.type === "struct") {
          userDefinedTypes.add(item.name);
        }
      }

      // Also look for types in the contract interfaces section if available
      if (abi.contractName) {
        userDefinedTypes.add(abi.contractName);
      }
    } catch (error) {
      console.warn(`Error processing ABI file ${file}:`, error);
    }
  }

  // Helper function to categorize types
  function processType(type: string) {
    if (!type) return;

    // Remove array brackets for classification
    const baseType = type.replace(/\[\d*\]/g, "");

    // Check if it's a native type or user-defined
    if (isNativeType(baseType)) {
      nativeTypes.add(baseType);
    } else {
      userDefinedTypes.add(baseType);
    }
  }

  // Helper function to extract user-defined types from internalType
  function processInternalType(internalType: string) {
    if (!internalType) return;

    // Extract struct names from internalType (e.g., "struct Descriptor" -> "Descriptor")
    if (internalType.startsWith("struct ")) {
      userDefinedTypes.add(internalType.substring(7));
    }
    // Extract enum names
    else if (internalType.startsWith("enum ")) {
      userDefinedTypes.add(internalType.substring(5));
    }
    // Extract contract names
    else if (internalType.startsWith("contract ")) {
      userDefinedTypes.add(internalType.substring(9));
    }
    // If it's not a native type and doesn't match the patterns above, it might be a custom type
    else if (!isNativeType(internalType.replace(/\[\d*\]/g, ""))) {
      userDefinedTypes.add(internalType.replace(/\[\d*\]/g, ""));
    }
  }

  return {
    nativeTypes: Array.from(nativeTypes).sort(),
    userDefinedTypes: Array.from(userDefinedTypes).sort(),
  };
}

/**
 * Check if a type is a native Solidity type
 */
function isNativeType(type: string): boolean {
  // Check if it's a native type using regex patterns
  if (/^(u?int\d*|address|bool|bytes\d*|string|function)$/.test(type)) {
    return true;
  }

  // Special case for bytes (without number)
  if (type === "bytes") {
    return true;
  }

  return false;
}

/**
 * Map user-defined types to their corresponding native types with detailed information
 * @param abiDir Directory containing ABI files
 * @returns Detailed information about user-defined types
 */
function mapUserDefinedToNativeTypes(abiDir: string = path.resolve(process.cwd(), "abis")): Record<string, any> {
  // Store detailed type information
  const typeInfo: Record<string, any> = {};

  if (!fs.existsSync(abiDir)) {
    return typeInfo;
  }

  const files = fs.readdirSync(abiDir).filter((file) => file.endsWith(".json"));

  for (const file of files) {
    try {
      const abiPath = path.join(abiDir, file);
      const abiContent = fs.readFileSync(abiPath, "utf8");
      const abi = JSON.parse(abiContent);
      const contractName = path.basename(file, ".json");

      // Process structs and custom types
      for (const item of abi.abi || []) {
        // Process functions to find structs and custom types
        if (item.type === "function") {
          // Check inputs and outputs for structs
          for (const param of [...(item.inputs || []), ...(item.outputs || [])]) {
            processParameter(param, contractName, file);
          }
        }
        
        // Process errors and events
        if (item.type === "error" || item.type === "event") {
          for (const param of item.inputs || []) {
            processParameter(param, contractName, file);
          }
        }
      }
    } catch (error) {
      console.warn(`Error processing ABI file ${file} for type mapping:`, error);
    }
  }

  // Helper function to process a parameter and extract type information
  function processParameter(param: any, contractName: string, file: string) {
    if (!param) return;

    // Process struct types
    if (param.internalType?.startsWith("struct ") && param.type === "tuple" && param.components) {
      const structName = param.internalType.substring(7);
      
      // If we haven't seen this struct before or have more complete info now
      if (!typeInfo[structName] || !typeInfo[structName].fields) {
        typeInfo[structName] = {
          kind: "struct",
          nativeType: "tuple",
          sourceContract: contractName,
          sourceFile: file,
          fields: param.components.map((comp: any) => ({
            name: comp.name,
            type: comp.type,
            internalType: comp.internalType
          }))
        };
      }
      
      // Process nested structs in components
      for (const component of param.components) {
        processParameter(component, contractName, file);
      }
    }
    // Process enum types
    else if (param.internalType?.startsWith("enum ")) {
      const enumName = param.internalType.substring(5);
      
      if (!typeInfo[enumName]) {
        typeInfo[enumName] = {
          kind: "enum",
          nativeType: param.type,
          sourceContract: contractName,
          sourceFile: file,
          // We can't get enum values from ABI directly
          values: []
        };
      }
    }
    // Process contract types
    else if (param.internalType?.startsWith("contract ")) {
      const contractTypeName = param.internalType.substring(9);
      
      if (!typeInfo[contractTypeName]) {
        typeInfo[contractTypeName] = {
          kind: "contract",
          nativeType: param.type,
          sourceContract: contractName,
          sourceFile: file
        };
      }
    }
    // Other user-defined types
    else if (param.internalType && param.type && param.internalType !== param.type && !isNativeType(param.internalType)) {
      const cleanType = param.internalType.replace(/^(contract|enum|struct) /, "");
      
      if (!typeInfo[cleanType]) {
        typeInfo[cleanType] = {
          kind: "userType",
          nativeType: param.type,
          sourceContract: contractName,
          sourceFile: file
        };
      }
    }
    
    // Process components if this is a tuple
    if (param.components) {
      for (const component of param.components) {
        processParameter(component, contractName, file);
      }
    }
  }

  return typeInfo;
}

// Example usage:
const types = extractDistinctTypes();
console.log("Native types:", types.nativeTypes);
console.log("User-defined types:", types.userDefinedTypes);

// Map user-defined types to their corresponding native types with detailed information
const typeInfo = mapUserDefinedToNativeTypes();
console.log("\nDetailed information about user-defined types:");
for (const [typeName, info] of Object.entries(typeInfo)) {
  console.log(`\n${typeName} (${info.kind}):`);
  console.log(`  Native type: ${info.nativeType}`);
  console.log(`  Source: ${info.sourceContract} (${info.sourceFile})`);
  
  // Print fields for structs
  if (info.kind === "struct" && info.fields) {
    console.log("  Fields:");
    for (const field of info.fields) {
      console.log(`    ${field.name}: ${field.type}${field.internalType !== field.type ? ` (${field.internalType})` : ''}`);
    }
  }
  
  // Print values for enums if available
  if (info.kind === "enum" && info.values && info.values.length > 0) {
    console.log("  Values:", info.values.join(", "));
  }
}
