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

// ai! implement a class that can rename a Command if the same name exists, the first one called name, the following one called name2, name3, ...
class RenameIfExists {
  counts: Map<string, number>;
}

async function main() {
  const program = new Command()
    .name("every-cli")
    .description("CLI for interacting with Every Protocol contracts")
    .version(pkg.version);

  const abis = loadContractAbis();

  const kindCmd = program.command("kind").description(`kind commands`);
  const kindSubCmdCtx = { parentCmd: "kind", contract: abis.kind.implementation };
  abis.kind.functions
    .map((f) => generateCommand(f, abis.kind.nonFunctions, kindSubCmdCtx))
    .forEach((subCmd) => kindCmd.addCommand(subCmd));

  const setCmd = program.command("set").description(`set commands`);
  const setSubCmdCtx = { parentCmd: "set", contract: abis.set.implementation };
  abis.set.functions
    .map((f) => generateCommand(f, abis.set.nonFunctions, setSubCmdCtx))
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
