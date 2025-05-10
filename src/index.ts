#!/usr/bin/env bun

import { Command } from "commander";
import { defineSubCommands, generateCommand, loadAbiFunctions, loadAbiNonFunctions } from "./autocmd";
import { CommandConfig, ContractFunction, CommandContext } from "./types";
import pkg from "../package.json" assert { type: "json" };
import { setRegisterCmd } from "./cmds/set";

// Interface to hold contract ABI functions and non-functions
interface ContractAbi {
  interface: string;
  implementation: string;
  functions: ContractFunction[];
  nonFunctions: ContractFunction[];
}

// Function to load all contract ABIs
function loadContractAbis() {
  return {
    kind: {
      interface: "IKindRegistry",
      implementation: "KindRegistry",
      functions: loadAbiFunctions("IKindRegistry"),
      nonFunctions: loadAbiNonFunctions("KindRegistry"),
    },
    set: {
      interface: "ISetRegistry",
      implementation: "SetRegistry",
      functions: loadAbiFunctions("ISetRegistry"),
      nonFunctions: loadAbiNonFunctions("SetRegistry"),
    },
    relation: {
      interface: "IOmniRegistry",
      implementation: "OmniRegistry",
      functions: loadAbiFunctions("IOmniRegistry").filter(startsWith("relation")),
      nonFunctions: loadAbiNonFunctions("OmniRegistry"),
    },
    unique: {
      interface: "IElementRegistry",
      implementation: "ElementRegistry",
      functions: loadAbiFunctions("IElementRegistry").filter(startsWith("unique")),
      nonFunctions: loadAbiNonFunctions("ElementRegistry"),
    },
    value: {
      interface: "IElementRegistry",
      implementation: "ElementRegistry",
      functions: loadAbiFunctions("IElementRegistry").filter(startsWith("value")),
      nonFunctions: loadAbiNonFunctions("ElementRegistry"),
    },
    mintpolicy: {
      interface: "IObjectMinter",
      implementation: "ObjectMinter",
      functions: loadAbiFunctions("IObjectMinter"),
      nonFunctions: loadAbiNonFunctions("ObjectMinter"),
    },
    object: {
      interface: "ISet",
      implementation: "ISet",
      functions: loadAbiFunctions("ISet"),
      nonFunctions: loadAbiNonFunctions("ISet"),
    },
  };
}

await main();

/**
 * Utility class to handle command name conflicts by adding numeric suffixes
 * The first command keeps its original name, subsequent commands with the same name
 * get renamed to name2, name3, etc.
 */
class CommandNameManager {
  private counts: Map<string, number> = new Map();

  /**
   * Get a unique name for a command, adding a numeric suffix if needed
   * @param baseName The original command name
   * @returns A unique command name
   */
  getUniqueName(baseName: string): string {
    const count = this.counts.get(baseName) || 0;
    this.counts.set(baseName, count + 1);
    
    // First occurrence keeps the original name
    if (count === 0) {
      return baseName;
    }
    
    // Subsequent occurrences get a numeric suffix
    return `${baseName}${count + 1}`;
  }
  
  /**
   * Reset the counter for a specific name or all names
   * @param baseName Optional name to reset, if not provided all counters are reset
   */
  reset(baseName?: string): void {
    if (baseName) {
      this.counts.delete(baseName);
    } else {
      this.counts.clear();
    }
  }
}

async function main() {
  const program = new Command()
    .name("every-cli")
    .description("CLI for interacting with Every Protocol contracts")
    .version(pkg.version);

  const abis = loadContractAbis();

  // Create a command name manager to handle duplicate function names
  const nameManager = new CommandNameManager();
  
  const kindCmd = program.command("kind").description(`kind commands`);
  const kindSubCmdCtx = { parentCmd: "kind", contract: abis.kind.implementation };
  abis.kind.functions
    .sort((a, b) => a.name.localeCompare(b.name)) // Sort by name for consistent ordering
    .map((f) => {
      const uniqueName = nameManager.getUniqueName(f.name);
      return generateCommand(f, abis.kind.nonFunctions, kindSubCmdCtx, uniqueName);
    })
    .forEach((subCmd) => kindCmd.addCommand(subCmd));
  
  // Reset name manager for each top-level command
  nameManager.reset();
  
  const setCmd = program.command("set").description(`set commands`);
  const setSubCmdCtx = { parentCmd: "set", contract: abis.set.implementation };
  abis.set.functions
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => {
      const uniqueName = nameManager.getUniqueName(f.name);
      return generateCommand(f, abis.set.nonFunctions, setSubCmdCtx, uniqueName);
    })
    .forEach((subCmd) => setCmd.addCommand(subCmd));
  setCmd.addCommand(setRegisterCmd);

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
