import fs from "fs";
import path from "path";

// Type definitions for ABI types
export type TypeKind = "native" | "struct" | "enum" | "tuple";

export interface AbiTypeInfo {
  // Standard ABI fields
  name: string;
  type: string;
  internalType?: string;
  components?: AbiTypeInfo[];
  
  // Extended fields for our type system
  kind: TypeKind;
  values?: string[];
  sourceContract?: string;
  sourceFile?: string;
}

/**
 * Build a registry of all types from ABI files
 */
export function buildTypeRegistry(abiDir: string = path.resolve(process.cwd(), "abis")): Map<string, AbiTypeInfo> {
  const typeRegistry = new Map<string, AbiTypeInfo>();

  // Register native types
  registerNativeTypes(typeRegistry);

  if (!fs.existsSync(abiDir)) {
    console.warn(`ABI directory not found: ${abiDir}`);
    return typeRegistry;
  }

  const files = fs.readdirSync(abiDir).filter((file) => file.endsWith(".json"));

  for (const file of files) {
    try {
      const abiPath = path.join(abiDir, file);
      const abiContent = fs.readFileSync(abiPath, "utf8");
      const abi = JSON.parse(abiContent);
      const contractName = path.basename(file, ".json");

      // Process all items in the ABI
      for (const item of abi.abi || []) {
        if (item.type === "function" || item.type === "event" || item.type === "error") {
          // Process inputs and outputs
          const params = [...(item.inputs || [])];
          if (item.type === "function") {
            params.push(...(item.outputs || []));
          }

          for (const param of params) {
            processTypeDefinition(param, typeRegistry, contractName, file);
          }
        }
      }
    } catch (error) {
      console.warn(`Error processing ABI file ${file}:`, error);
    }
  }

  return typeRegistry;
}

/**
 * Process a parameter type definition and add it to the registry
 */
function processTypeDefinition(
  param: any,
  registry: Map<string, AbiTypeInfo>,
  contractName: string,
  file: string
): void {
  if (!param || !param.type) return;

  // Handle struct types
  if (param.internalType?.startsWith("struct ") && param.type === "tuple") {
    const structName = param.internalType.substring(7);

    // Skip if we already have this struct with components
    if (registry.has(structName) && registry.get(structName)?.components) {
      return;
    }

    const components: AbiTypeInfo[] = [];

    // Process components
    if (param.components) {
      for (const component of param.components) {
        processTypeDefinition(component, registry, contractName, file);

        if (component.type) {
          const componentType = parseTypeString(component.type, registry);
          if (componentType) {
            components.push(componentType);
          }
        }
      }
    }

    // Make sure we preserve the original component names from the ABI
    const namedComponents = param.components.map((component: any, index: number) => {
      // Use the component from our registry but preserve the original name
      const processedComponent = components[index] || { 
        name: component.name,
        type: component.type,
        internalType: component.internalType,
        kind: "native"
      };
      
      // Ensure the name is preserved
      processedComponent.name = component.name;
      return processedComponent;
    });
    
    registry.set(structName, {
      name: structName,
      type: "tuple",
      internalType: `struct ${structName}`,
      kind: "struct",
      components: namedComponents,
      sourceContract: contractName,
      sourceFile: file,
    });
  }
  // Handle enum types
  else if (param.internalType?.startsWith("enum ")) {
    const enumName = param.internalType.substring(5);

    if (!registry.has(enumName)) {
      registry.set(enumName, {
        name: enumName,
        type: param.type,
        internalType: `enum ${enumName}`,
        kind: "enum",
        values: [], // We can't get enum values from ABI directly
        sourceContract: contractName,
        sourceFile: file,
      });
    }
  }
  // Handle tuple types
  else if (param.type === "tuple") {
    const components: AbiTypeInfo[] = [];

    // Process components
    if (param.components) {
      for (const component of param.components) {
        processTypeDefinition(component, registry, contractName, file);

        if (component.type) {
          const componentType = parseTypeString(component.type, registry);
          if (componentType) {
            components.push(componentType);
          }
        }
      }
    }

    // Create a tuple name from its components
    const tupleName = `(${components.map((c) => c.name).join(",")})`;

    registry.set(tupleName, {
      name: tupleName,
      type: "tuple",
      internalType: tupleName,
      kind: "tuple",
      components,
      sourceContract: contractName,
      sourceFile: file,
    });
  }
  // Handle array types
  else if (param.type.includes("[")) {
    const baseTypeName = param.type.replace(/\[\d*\]/g, "");
    const baseType = parseTypeString(baseTypeName, registry);

    if (baseType) {
      const arrayDimensions = param.type.match(/\[\d*\]/g) || [];
      let arrayType = baseType;

      for (const dim of arrayDimensions) {
        const arrayName = `${arrayType.name}${dim}`;

        if (!registry.has(arrayName)) {
          registry.set(arrayName, {
            name: arrayName,
            type: `${arrayType.type}${dim}`,
            internalType: arrayType.internalType ? `${arrayType.internalType}${dim}` : undefined,
            kind: arrayType.kind,
            components: arrayType.components,
            sourceContract: contractName,
            sourceFile: file,
          });
        }

        arrayType = registry.get(arrayName)!;
      }
    }
  }

  // Process nested components if any
  if (param.components) {
    for (const component of param.components) {
      processTypeDefinition(component, registry, contractName, file);
    }
  }
}

/**
 * Register all native Solidity types in the registry
 */
function registerNativeTypes(registry: Map<string, AbiTypeInfo>): void {
  // Integer types
  for (let i = 8; i <= 256; i += 8) {
    registry.set(`uint${i}`, { name: `uint${i}`, type: `uint${i}`, internalType: `uint${i}`, kind: "native" });
    registry.set(`int${i}`, { name: `int${i}`, type: `int${i}`, internalType: `int${i}`, kind: "native" });
  }

  // Special cases
  registry.set("uint", { name: "uint", type: "uint256", internalType: "uint256", kind: "native" });
  registry.set("int", { name: "int", type: "int256", internalType: "int256", kind: "native" });

  // Address, bool, string
  registry.set("address", { name: "address", type: "address", internalType: "address", kind: "native" });
  registry.set("bool", { name: "bool", type: "bool", internalType: "bool", kind: "native" });
  registry.set("string", { name: "string", type: "string", internalType: "string", kind: "native" });

  // Bytes
  registry.set("bytes", { name: "bytes", type: "bytes", internalType: "bytes", kind: "native" });
  for (let i = 1; i <= 32; i++) {
    registry.set(`bytes${i}`, { name: `bytes${i}`, type: `bytes${i}`, internalType: `bytes${i}`, kind: "native" });
  }
}

/**
 * Parse a type string and return the corresponding AbiTypeInfo
 */
export function parseTypeString(typeStr: string, registry: Map<string, AbiTypeInfo>): AbiTypeInfo | undefined {
  // Check if it's a direct match in the registry
  if (registry.has(typeStr)) {
    return registry.get(typeStr);
  }

  // Check if it's an array type
  if (typeStr.includes("[")) {
    const baseTypeName = typeStr.replace(/\[\d*\]/g, "");
    const baseType = registry.get(baseTypeName);

    if (baseType) {
      const arrayDimensions = typeStr.match(/\[\d*\]/g) || [];
      let arrayType = baseType;

      for (const dim of arrayDimensions) {
        const arrayName = `${arrayType.name}${dim}`;
        arrayType = registry.get(arrayName) || {
          name: arrayName,
          type: `${arrayType.type}${dim}`,
          internalType: arrayType.internalType ? `${arrayType.internalType}${dim}` : undefined,
          kind: arrayType.kind,
          components: arrayType.components,
        };
      }

      return arrayType;
    }
  }

  // Check if it's a tuple type (starts with '(' and ends with ')')
  if (typeStr.startsWith("(") && typeStr.endsWith(")")) {
    // Parse the tuple components
    const componentsStr = typeStr.substring(1, typeStr.length - 1);
    const componentNames = componentsStr.split(",");

    const components: AbiTypeInfo[] = [];
    for (const name of componentNames) {
      const component = registry.get(name);
      if (component) {
        components.push(component);
      } else {
        console.warn(`Unknown type in tuple: ${name}`);
        return undefined;
      }
    }

    return {
      name: typeStr,
      type: "tuple",
      internalType: typeStr,
      kind: "tuple",
      components,
    };
  }

  // Type not found
  return undefined;
}

/**
 * Parse a string value into the appropriate JavaScript value based on the type
 */
export function parseValue(registry: Map<string, AbiTypeInfo>, typeName: string, valueStr: string): any {
  // Get the type information from the registry
  const typeInfo = parseTypeString(typeName, registry);
  if (!typeInfo) {
    throw new Error(`Unknown type: ${typeName}`);
  }

  // Handle different kinds of types
  switch (typeInfo.kind) {
    case "native":
      const nativeValue = parseNativeValue(typeInfo.type, valueStr);
      if (nativeValue === undefined) {
        throw new Error(`Failed to parse native value for type ${typeName}: ${valueStr}`);
      }
      return nativeValue;

    case "struct":
      // Check for duplicate field names
      const fieldNames = typeInfo.components?.map(c => c.name) || [];
      const hasDuplicates = fieldNames.some((name, index) => 
        fieldNames.indexOf(name) !== index
      );
      
      // Handle both object notation and tuple notation
      if (valueStr.startsWith("{") && valueStr.endsWith("}")) {
        return parseStructObjectNotation(typeInfo, valueStr);
      } else if (valueStr.startsWith("(") && valueStr.endsWith(")")) {
        if (hasDuplicates) {
          // For structs with duplicate field names, return the raw tuple values
          const tupleValues = parseTupleNotation(typeInfo, valueStr);
          if (!tupleValues) {
            throw new Error(`Failed to parse tuple values for ${typeName}`);
          }
          return tupleValues;
        } else {
          return parseStructTupleNotation(typeInfo, valueStr);
        }
      } else {
        throw new Error(
          `Invalid struct value format for ${typeName}: ${valueStr}. Expected object notation {field=value} or tuple notation (value1,value2)`
        );
      }

    case "enum":
      // For enums, we expect either a number or a string value
      if (/^\d+$/.test(valueStr)) {
        return parseInt(valueStr, 10);
      } else if (valueStr) {
        // If it's a string value, we would need the enum definition to map it to a number
        // Since we don't have enum values in the ABI, we'll just return the string
        return valueStr;
      } else {
        throw new Error(`Invalid enum value for ${typeName}: ${valueStr}`);
      }

    case "tuple":
      // For tuples, we expect a parenthesized list of values
      if (valueStr.startsWith("(") && valueStr.endsWith(")")) {
        const result = parseTupleNotation(typeInfo, valueStr);
        if (!result) {
          throw new Error(`Failed to parse tuple value for ${typeName}: ${valueStr}`);
        }
        return result;
      } else {
        throw new Error(
          `Invalid tuple value format for ${typeName}: ${valueStr}. Expected tuple notation (value1,value2)`
        );
      }

    default:
      throw new Error(`Unsupported type kind: ${typeInfo.kind}`);
  }
}

/**
 * Parse a native Solidity type value
 */
function parseNativeValue(abiType: string, valueStr: string): any {
  // Handle array types
  if (abiType.includes("[")) {
    // For arrays, we expect a JSON array
    try {
      const parsed = JSON.parse(valueStr);
      if (!Array.isArray(parsed)) {
        throw new Error(`Expected array value for type ${abiType}, got: ${valueStr}`);
      }
      // Process each element in the array according to the base type
      const baseType = abiType.replace(/\[\d*\]/g, "");
      return parsed.map(item => parseNativeValue(baseType, item.toString()));
    } catch (error) {
      throw new Error(`Failed to parse array value for type ${abiType}: ${valueStr}. ${error.message}`);
    }
  }

  // Handle different native types
  if (abiType.startsWith("uint") || abiType.startsWith("int")) {
    // For integers, parse as number or BigInt depending on size
    try {
      const bitSize = parseInt(abiType.replace(/^(u)?int/, "")) || 256;
      // Use regular number for small integers, BigInt for larger ones
      if (bitSize <= 53) {
        return parseInt(valueStr, 10);
      } else {
        return BigInt(valueStr);
      }
    } catch (error) {
      throw new Error(`Failed to parse integer value for type ${abiType}: ${valueStr}. ${error.message}`);
    }
  } else if (abiType === "address") {
    // For addresses, validate format and ensure correct length
    if (/^0x[0-9a-fA-F]{1,40}$/.test(valueStr)) {
      // Pad to full length if needed
      return valueStr.padEnd(42, "0").toLowerCase();
    } else {
      throw new Error(
        `Invalid address format for type ${abiType}: ${valueStr}. Expected 0x followed by hex characters.`
      );
    }
  } else if (abiType === "bool") {
    // For booleans, accept true/false or 0/1
    if (valueStr.toLowerCase() === "true" || valueStr === "1") {
      return true;
    } else if (valueStr.toLowerCase() === "false" || valueStr === "0") {
      return false;
    } else {
      throw new Error(`Invalid boolean value for type ${abiType}: ${valueStr}. Expected true/false or 1/0.`);
    }
  } else if (abiType === "string") {
    // For strings, return as is
    return valueStr;
  } else if (abiType.startsWith("bytes")) {
    // For fixed-length bytes, ensure correct length
    if (abiType !== "bytes") {
      const byteLength = parseInt(abiType.replace("bytes", ""));
      const expectedHexLength = byteLength * 2 + 2; // +2 for "0x" prefix
      
      if (/^0x[0-9a-fA-F]*$/.test(valueStr)) {
        // Pad or truncate to correct length
        if (valueStr.length < expectedHexLength) {
          return valueStr.padEnd(expectedHexLength, "0");
        } else if (valueStr.length > expectedHexLength) {
          console.warn(`Warning: Truncating bytes value to match ${abiType} length`);
          return valueStr.substring(0, expectedHexLength);
        }
        return valueStr;
      } else {
        throw new Error(`Invalid bytes format for type ${abiType}: ${valueStr}. Expected 0x followed by hex characters.`);
      }
    } 
    // For dynamic bytes, just validate format
    else if (/^0x[0-9a-fA-F]*$/.test(valueStr)) {
      return valueStr;
    } else {
      throw new Error(`Invalid bytes format for type ${abiType}: ${valueStr}. Expected 0x followed by hex characters.`);
    }
  } else {
    throw new Error(`Unsupported native type: ${abiType}`);
  }
}

/**
 * Parse a struct value in object notation (e.g., "{field1=value1, field2=value2}")
 */
function parseStructObjectNotation(typeInfo: AbiTypeInfo, valueStr: string): any {
  if (!typeInfo.components) {
    throw new Error(`No component information available for struct: ${typeInfo.name}`);
  }

  // Remove the curly braces and split by commas
  const content = valueStr.substring(1, valueStr.length - 1).trim();
  if (!content && typeInfo.components.length > 0) {
    throw new Error(
      `Empty object provided for struct ${typeInfo.name} which requires ${typeInfo.components.length} fields`
    );
  }

  const fieldPairs = content.split(",").map((pair) => pair.trim());
  const result: any = {};
  const providedFields = new Set<string>();

  for (const pair of fieldPairs) {
    const [fieldName, fieldValueStr] = pair.split("=").map((part) => part.trim());
    providedFields.add(fieldName);

    // Find the component with this field name
    const component = typeInfo.components.find((comp) => comp.name === fieldName);
    if (!component) {
      throw new Error(`Unknown field in struct ${typeInfo.name}: ${fieldName}`);
    }

    // Parse the field value based on its type
    const parsedValue = parseValue(new Map([[component.name, component]]), component.name, fieldValueStr);
    if (parsedValue === undefined) {
      throw new Error(`Failed to parse value for field '${fieldName}' in struct ${typeInfo.name}`);
    }

    result[fieldName] = parsedValue;
  }

  // Check if all required fields are provided
  for (const component of typeInfo.components) {
    if (!providedFields.has(component.name)) {
      throw new Error(`Missing required field '${component.name}' in struct ${typeInfo.name}`);
    }
  }

  return result;
}

/**
 * Parse a struct value in tuple notation (e.g., "(value1, value2)")
 */
function parseStructTupleNotation(typeInfo: AbiTypeInfo, valueStr: string): any {
  if (!typeInfo.components) {
    throw new Error(`No component information available for struct: ${typeInfo.name}`);
  }

  // Parse as a tuple and then convert to an object
  const tupleValues = parseTupleNotation(typeInfo, valueStr);
  if (!tupleValues) {
    throw new Error(`Failed to parse tuple values for struct: ${typeInfo.name}`);
  }

  // Check if we have all required fields
  if (tupleValues.length < typeInfo.components.length) {
    throw new Error(
      `Missing fields for struct ${typeInfo.name}. Expected ${typeInfo.components.length} values, got ${tupleValues.length}`
    );
  }

  // Check for duplicate field names
  const fieldNames = typeInfo.components.map(c => c.name);
  const duplicateNames = fieldNames.filter((name, index) => 
    fieldNames.indexOf(name) !== index
  );
  
  if (duplicateNames.length > 0) {
    throw new Error(
      `Struct ${typeInfo.name} has duplicate field names: ${duplicateNames.join(', ')}. ` +
      `Cannot safely parse using tuple notation. Use array notation instead.`
    );
  }

  // Convert the array of values to an object with field names
  const result: any = {};
  typeInfo.components.forEach((component, index) => {
    if (index < tupleValues.length) {
      result[component.name] = tupleValues[index];
    } else {
      throw new Error(`Missing value for field '${component.name}' in struct ${typeInfo.name}`);
    }
  });

  return result;
}

/**
 * Parse a tuple value (e.g., "(value1, value2)")
 */
function parseTupleNotation(typeInfo: AbiTypeInfo, valueStr: string): any[] | undefined {
  if (!typeInfo.components) {
    throw new Error(`No component information available for tuple: ${typeInfo.name}`);
  }

  // Remove the parentheses
  const content = valueStr.substring(1, valueStr.length - 1).trim();
  if (!content && typeInfo.components.length > 0) {
    throw new Error(
      `Empty tuple provided for type ${typeInfo.name} which requires ${typeInfo.components.length} values`
    );
  }

  // Split the content by commas, respecting nested structures
  const valueStrs = splitTupleValues(content);

  // Check if we have enough values
  if (valueStrs.length < typeInfo.components.length) {
    throw new Error(
      `Not enough values for tuple ${typeInfo.name}. Expected ${typeInfo.components.length}, got ${valueStrs.length}`
    );
  }

  // Parse each value based on its corresponding component type
  const result: any[] = [];
  for (let i = 0; i < typeInfo.components.length; i++) {
    const component = typeInfo.components[i];
    const componentValueStr = i < valueStrs.length ? valueStrs[i].trim() : "";

    if (!componentValueStr) {
      throw new Error(`Missing value for component ${i} (${component.name}) in tuple ${typeInfo.name}`);
    }

    // Parse the component value
    try {
      const componentValue = parseValue(new Map([[component.name, component]]), component.name, componentValueStr);
      if (componentValue === undefined) {
        throw new Error(`Failed to parse value for component ${i} (${component.name}) in tuple ${typeInfo.name}`);
      }
      result.push(componentValue);
    } catch (error) {
      // Try direct parsing if component-based parsing fails
      if (component.type && (component.type.startsWith("uint") || component.type.startsWith("int"))) {
        try {
          const bitSize = parseInt(component.type.replace(/^(u)?int/, "")) || 256;
          result.push(bitSize <= 53 ? parseInt(componentValueStr, 10) : BigInt(componentValueStr));
          continue;
        } catch (e) {
          // Fall through to the error
        }
      } else if (component.type && component.type.startsWith("bytes")) {
        if (/^0x[0-9a-fA-F]*$/.test(componentValueStr)) {
          result.push(componentValueStr);
          continue;
        }
      }
      throw error;
    }
  }

  return result;
}

/**
 * Split a tuple content string into individual value strings, respecting nested structures
 */
function splitTupleValues(content: string): string[] {
  const result: string[] = [];
  let currentValue = "";
  let depth = 0;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if ((char === "," || char === ";") && depth === 0) {
      // Found a top-level separator
      result.push(currentValue.trim());
      currentValue = "";
    } else {
      // Add the character to the current value
      currentValue += char;

      // Track nesting depth
      if (char === "(" || char === "{" || char === "[") {
        depth++;
      } else if (char === ")" || char === "}" || char === "]") {
        depth--;
      }
    }
  }

  // Add the last value
  if (currentValue.trim()) {
    result.push(currentValue.trim());
  }

  return result;
}

/**
 * Get example input for a type
 */
export function getTypeExample(typeInfo: AbiTypeInfo): string {
  switch (typeInfo.kind) {
    case "native":
      return getNativeTypeExample(typeInfo.type);
    case "struct":
      if (!typeInfo.components || typeInfo.components.length === 0) {
        return "{}";
      }
      // Check for duplicate field names
      const fieldNames = typeInfo.components.map(c => c.name);
      const hasDuplicates = fieldNames.some((name, index) => 
        fieldNames.indexOf(name) !== index
      );
      
      // Generate examples
      if (hasDuplicates) {
        // For structs with duplicate field names, only show tuple notation
        const tupleExample = `(${typeInfo.components.map((comp) => getTypeExample(comp)).join(", ")})`;
        return `Tuple notation (recommended for this struct with duplicate field names): ${tupleExample}`;
      } else {
        // Generate both object and tuple notation examples
        const objectExample = `{${typeInfo.components.map((comp) => `${comp.name}=${getTypeExample(comp)}`).join(", ")}}`;
        const tupleExample = `(${typeInfo.components.map((comp) => getTypeExample(comp)).join(", ")})`;
        return `Object notation: ${objectExample}\nTuple notation: ${tupleExample}`;
      }
    case "enum":
      return typeInfo.values && typeInfo.values.length > 0 ? typeInfo.values[0] : "0";
    case "tuple":
      if (!typeInfo.components || typeInfo.components.length === 0) {
        return "()";
      }
      return `(${typeInfo.components.map((comp) => getTypeExample(comp)).join(", ")})`;
    default:
      return "unknown";
  }
}

/**
 * Get example for native types
 */
function getNativeTypeExample(abiType: string): string {
  if (abiType.startsWith("uint") || abiType.startsWith("int")) {
    return "123";
  } else if (abiType === "address") {
    return "0x1234567890123456789012345678901234567890";
  } else if (abiType === "bool") {
    return "true";
  } else if (abiType === "string") {
    return "'example string'";
  } else if (abiType.startsWith("bytes")) {
    return "0x1234";
  } else if (abiType.includes("[")) {
    // For arrays
    const baseType = abiType.replace(/\[\d*\]/g, "");
    const baseExample = getNativeTypeExample(baseType);
    return `[${baseExample}, ${baseExample}]`;
  }
  return "unknown";
}

/**
 * List all types in the registry by category
 */
export function listTypes(registry: Map<string, AbiTypeInfo>): {
  native: string[];
  structs: string[];
  enums: string[];
  tuples: string[];
} {
  const result = {
    native: [] as string[],
    structs: [] as string[],
    enums: [] as string[],
    tuples: [] as string[],
  };

  for (const [name, info] of registry.entries()) {
    switch (info.kind) {
      case "native":
        result.native.push(name);
        break;
      case "struct":
        result.structs.push(name);
        break;
      case "enum":
        result.enums.push(name);
        break;
      case "tuple":
        // Only include named tuples, not auto-generated ones
        if (!name.startsWith("(")) {
          result.tuples.push(name);
        }
        break;
    }
  }

  // Sort each category
  result.native.sort();
  result.structs.sort();
  result.enums.sort();
  result.tuples.sort();

  return result;
}

/**
 * Get detailed information about a type
 */
export function getTypeInfo(typeName: string, registry: Map<string, AbiTypeInfo>): AbiTypeInfo | undefined {
  return registry.get(typeName) || parseTypeString(typeName, registry);
}
