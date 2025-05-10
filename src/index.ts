#!/usr/bin/env bun

import { Command } from "commander";
import { defineSubCommands, generateCommand, loadAbiFunctions, loadAbiNonFunctions } from "./autocmd";
import { CommandConfig, ContractFunction, CommandContext } from "./types";
import pkg from "../package.json" assert { type: "json" };

// Interface to hold contract ABI functions and non-functions
interface ContractAbi {
  name: string;
  interface: string;
  implementation: string;
  functions: ContractFunction[];
  nonFunctions: ContractFunction[];
  filter?: (func: ContractFunction) => boolean;
}

// Function to load all contract ABIs
function loadContractAbis(): ContractAbi[] {
  return [
    {
      name: "kind",
      interface: "IKindRegistry",
      implementation: "KindRegistry",
      functions: loadAbiFunctions("IKindRegistry"),
      nonFunctions: loadAbiNonFunctions("KindRegistry"),
    },
    {
      name: "set",
      interface: "ISetRegistry",
      implementation: "SetRegistry",
      functions: loadAbiFunctions("ISetRegistry"),
      nonFunctions: loadAbiNonFunctions("SetRegistry"),
    },
    {
      name: "relation",
      interface: "IOmniRegistry",
      implementation: "OmniRegistry",
      functions: loadAbiFunctions("IOmniRegistry").filter(startsWith("relation")),
      nonFunctions: loadAbiNonFunctions("OmniRegistry"),
    },
    {
      name: "unique",
      interface: "IElementRegistry",
      implementation: "ElementRegistry",
      functions: loadAbiFunctions("IElementRegistry").filter(startsWith("unique")),
      nonFunctions: loadAbiNonFunctions("ElementRegistry"),
    },
    {
      name: "value",
      interface: "IElementRegistry",
      implementation: "ElementRegistry",
      functions: loadAbiFunctions("IElementRegistry").filter(startsWith("value")),
      nonFunctions: loadAbiNonFunctions("ElementRegistry"),
    },
    {
      name: "mintpolicy",
      interface: "IObjectMinter",
      implementation: "ObjectMinter",
      functions: loadAbiFunctions("IObjectMinter"),
      nonFunctions: loadAbiNonFunctions("ObjectMinter"),
    },
    {
      name: "object",
      interface: "ISet",
      implementation: "ISet",
      functions: loadAbiFunctions("ISet"),
      nonFunctions: loadAbiNonFunctions("ISet"),
    },
  ];
}

await main();

async function main() {
  const program = new Command()
    .name("every-cli")
    .description("CLI for interacting with Every Protocol contracts")
    .version(pkg.version);

  // Load all contract ABIs
  const contractAbis = loadContractAbis();
  
  // Create commands for each contract
  for (const contractAbi of contractAbis) {
    const cmd = program.command(contractAbi.name).description(`${contractAbi.name} commands`);
    
    contractAbi.functions
      .map((func) => generateCommand(
        func, 
        contractAbi.nonFunctions, 
        { 
          parentCmd: contractAbi.name, 
          contract: contractAbi.implementation 
        }
      ))
      .forEach((subCmd) => cmd.addCommand(subCmd));
  }

  try {
    await program.parseAsync();
  } catch (e: any) {
    console.error(e.message);
  }
}

function lstrip(prefix: string): (name: string) => string {
  return function (name: string) {
    return name.substring(prefix.length).toLowerCase();
  };
}

function startsWith(prefix: string): (func: ContractFunction) => boolean {
  return function (func: ContractFunction) {
    return func.name.startsWith(prefix);
  };
}
