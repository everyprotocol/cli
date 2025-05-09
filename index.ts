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
  
  const files = fs.readdirSync(abiDir).filter(file => file.endsWith('.json'));
  
  for (const file of files) {
    try {
      const abiPath = path.join(abiDir, file);
      const abiContent = fs.readFileSync(abiPath, 'utf8');
      const abi = JSON.parse(abiContent);
      
      // Process ABI items
      for (const item of abi.abi || []) {
        // Extract types from function inputs and outputs
        if (item.type === 'function' || item.type === 'event') {
          // Process inputs
          for (const input of item.inputs || []) {
            processType(input.type);
            
            // Handle tuple components recursively
            if (input.components) {
              for (const component of input.components) {
                processType(component.type);
              }
            }
          }
          
          // Process outputs for functions
          if (item.type === 'function') {
            for (const output of item.outputs || []) {
              processType(output.type);
              
              // Handle tuple components recursively
              if (output.components) {
                for (const component of output.components) {
                  processType(component.type);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Error processing ABI file ${file}:`, error);
    }
  }
  
  // Helper function to categorize types
  function processType(type: string) {
    if (!type) return;
    
    // Remove array brackets for classification
    const baseType = type.replace(/\[\d*\]/g, '');
    
    // Check if it's a native type or user-defined
    if (isNativeType(baseType)) {
      nativeTypes.add(baseType);
    } else {
      userDefinedTypes.add(baseType);
    }
  }
  
  return {
    nativeTypes: Array.from(nativeTypes).sort(),
    userDefinedTypes: Array.from(userDefinedTypes).sort()
  };
}

/**
 * Check if a type is a native Solidity type
 */
function isNativeType(type: string): boolean {
  const nativeTypes = [
    // Integers
    'uint', 'uint8', 'uint16', 'uint24', 'uint32', 'uint40', 'uint48', 'uint56', 'uint64', 
    'uint72', 'uint80', 'uint88', 'uint96', 'uint104', 'uint112', 'uint120', 'uint128', 
    'uint136', 'uint144', 'uint152', 'uint160', 'uint168', 'uint176', 'uint184', 'uint192', 
    'uint200', 'uint208', 'uint216', 'uint224', 'uint232', 'uint240', 'uint248', 'uint256',
    
    'int', 'int8', 'int16', 'int24', 'int32', 'int40', 'int48', 'int56', 'int64', 
    'int72', 'int80', 'int88', 'int96', 'int104', 'int112', 'int120', 'int128', 
    'int136', 'int144', 'int152', 'int160', 'int168', 'int176', 'int184', 'int192', 
    'int200', 'int208', 'int216', 'int224', 'int232', 'int240', 'int248', 'int256',
    
    // Address
    'address',
    
    // Boolean
    'bool',
    
    // Bytes
    'bytes', 'bytes1', 'bytes2', 'bytes3', 'bytes4', 'bytes5', 'bytes6', 'bytes7', 'bytes8',
    'bytes9', 'bytes10', 'bytes11', 'bytes12', 'bytes13', 'bytes14', 'bytes15', 'bytes16',
    'bytes17', 'bytes18', 'bytes19', 'bytes20', 'bytes21', 'bytes22', 'bytes23', 'bytes24',
    'bytes25', 'bytes26', 'bytes27', 'bytes28', 'bytes29', 'bytes30', 'bytes31', 'bytes32',
    
    // String
    'string',
    
    // Tuple
    'tuple',
    
    // Function
    'function'
  ];
  
  return nativeTypes.includes(type);
}

// Example usage:
// const types = extractDistinctTypes();
// console.log('Native types:', types.nativeTypes);
// console.log('User-defined types:', types.userDefinedTypes);
