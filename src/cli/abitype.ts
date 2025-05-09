#!/usr/bin/env node
import { Command } from "commander";
import { 
  buildTypeRegistry, 
  parseValue, 
  listTypes, 
  getTypeInfo, 
  getTypeExample,
  parseTypeString
} from "../abitype";
import path from "path";

const program = new Command();

program
  .name("abitype")
  .description("CLI for working with Solidity ABI types")
  .version("0.1.0");

// Command to list all types
program
  .command("list")
  .description("List all available types")
  .option("-d, --dir <directory>", "ABI directory", path.resolve(process.cwd(), "abis"))
  .action((options) => {
    const registry = buildTypeRegistry(options.dir);
    const types = listTypes(registry);
    
    console.log("Native types:");
    types.native.forEach(t => console.log(`  ${t}`));
    
    console.log("\nStruct types:");
    types.structs.forEach(t => console.log(`  ${t}`));
    
    console.log("\nEnum types:");
    types.enums.forEach(t => console.log(`  ${t}`));
    
    console.log("\nTuple types:");
    types.tuples.forEach(t => console.log(`  ${t}`));
  });

// Command to get info about a type
program
  .command("info")
  .description("Get information about a specific type")
  .argument("<typeName>", "Name of the type")
  .option("-d, --dir <directory>", "ABI directory", path.resolve(process.cwd(), "abis"))
  .action((typeName, options) => {
    const registry = buildTypeRegistry(options.dir);
    const typeInfo = getTypeInfo(typeName, registry);
    
    if (!typeInfo) {
      console.error(`Type '${typeName}' not found`);
      process.exit(1);
    }
    
    console.log(`Type: ${typeInfo.name}`);
    console.log(`Kind: ${typeInfo.kind}`);
    console.log(`ABI Type: ${typeInfo.abiType}`);
    
    if (typeInfo.sourceContract) {
      console.log(`Source: ${typeInfo.sourceContract} (${typeInfo.sourceFile})`);
    }
    
    if (typeInfo.components && typeInfo.components.length > 0) {
      console.log("\nComponents:");
      typeInfo.components.forEach((comp, i) => {
        console.log(`  ${i+1}. ${comp.name}: ${comp.abiType}`);
      });
    }
    
    if (typeInfo.values && typeInfo.values.length > 0) {
      console.log("\nValues:");
      typeInfo.values.forEach((val, i) => {
        console.log(`  ${i}: ${val}`);
      });
    }
    
    console.log("\nExample:");
    console.log(getTypeExample(typeInfo));
  });

// Command to parse a value
program
  .command("parse")
  .description("Parse a value for a specific type")
  .argument("<typeName>", "Name of the type")
  .argument("[value]", "Value to parse")
  .option("-d, --dir <directory>", "ABI directory", path.resolve(process.cwd(), "abis"))
  .action((typeName, value, options) => {
    const registry = buildTypeRegistry(options.dir);
    const typeInfo = getTypeInfo(typeName, registry);
    
    if (!typeInfo) {
      console.error(`Type '${typeName}' not found`);
      process.exit(1);
    }
    
    // If no value provided, show example
    if (!value) {
      console.log(`Example input for ${typeName}:`);
      console.log(getTypeExample(typeInfo));
      return;
    }
    
    try {
      const parsedValue = parseValue(registry, typeName, value);
      console.log("Parsed value:");
      console.log(JSON.stringify(parsedValue, (_, v) => 
        typeof v === 'bigint' ? v.toString() : v, 2));
    } catch (error: any) {
      console.error(`Error parsing value: ${error.message}`);
      console.log(`\nExample input for ${typeName}:`);
      console.log(getTypeExample(typeInfo));
    }
  });

// Parse command line arguments
program.parse();
