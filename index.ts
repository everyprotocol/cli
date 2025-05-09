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
 * Map user-defined types to their corresponding native types
 * @param abiDir Directory containing ABI files
 * @returns Object mapping user-defined types to native types
 */
function mapUserDefinedToNativeTypes(abiDir: string = path.resolve(process.cwd(), "abis")): Record<string, string> {
  const typeMapping: Record<string, string> = {};

  if (!fs.existsSync(abiDir)) {
    return typeMapping;
  }

  const files = fs.readdirSync(abiDir).filter((file) => file.endsWith(".json"));

  for (const file of files) {
    try {
      const abiPath = path.join(abiDir, file);
      const abiContent = fs.readFileSync(abiPath, "utf8");
      const abi = JSON.parse(abiContent);

      // Process structs and custom types
      for (const item of abi.abi || []) {
        // Look for struct definitions
        if (item.type === "function") {
          // Check inputs and outputs for structs
          for (const param of [...(item.inputs || []), ...(item.outputs || [])]) {
            if (param.internalType && param.type) {
              // If internalType starts with "struct " and type is "tuple"
              if (param.internalType.startsWith("struct ") && param.type === "tuple") {
                const structName = param.internalType.substring(7);
                typeMapping[structName] = "tuple";
              }
              // For other custom types
              else if (param.internalType !== param.type && !isNativeType(param.internalType)) {
                const cleanType = param.internalType.replace(/^(contract|enum|struct) /, "");
                typeMapping[cleanType] = param.type;
              }
            }

            // Check components for nested structs
            if (param.components) {
              for (const component of param.components) {
                if (component.internalType && component.type) {
                  if (component.internalType.startsWith("struct ") && component.type === "tuple") {
                    const structName = component.internalType.substring(7);
                    typeMapping[structName] = "tuple";
                  } else if (component.internalType !== component.type && !isNativeType(component.internalType)) {
                    const cleanType = component.internalType.replace(/^(contract|enum|struct) /, "");
                    typeMapping[cleanType] = component.type;
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Error processing ABI file ${file} for type mapping:`, error);
    }
  }

  return typeMapping;
}

// Example usage:
const types = extractDistinctTypes();
console.log("Native types:", types.nativeTypes);
console.log("User-defined types:", types.userDefinedTypes);

// Map user-defined types to their corresponding native types
const typeMapping = mapUserDefinedToNativeTypes();
console.log("User-defined types with corresponding native types:");
for (const [userType, nativeType] of Object.entries(typeMapping)) {
  console.log(`  ${userType} => ${nativeType}`);
}

// ai! keep more info, struct/enum/usertype, and their fileds
