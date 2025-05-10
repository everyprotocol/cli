#!/usr/bin/env bun

import { Command } from "commander";
import { defineSubCommands, generateCommand, loadAbiFunctions, loadAbiNonFunctions } from "./autocmd";
import { CommandConfig, ContractFunction, CommandContext } from "./types";
import pkg from "../package.json" assert { type: "json" };

await main();

// ai! define a type/interface to hold all funcs and nonFuncs, and write a function to load them all

async function main() {
  const program = new Command()
    .name("every-cli")
    .description("CLI for interacting with Every Protocol contracts")
    .version(pkg.version);

  const kindCmd = program.command("kind").description("kind commands");
  const kindFuncs = loadAbiFunctions("IKindRegistry");
  const kindNonFuncs = loadAbiNonFunctions("KindRegistry");
  kindFuncs
    .map((func) => generateCommand(func, kindNonFuncs, { parentCmd: "kind", contract: "KindRegistry" }))
    .forEach((cmd) => kindCmd.addCommand(cmd));

  // Set command
  const setCmd = program.command("set").description("set commands");
  const setFuncs = loadAbiFunctions("ISetRegistry");
  const setNonFuncs = loadAbiNonFunctions("SetRegistry");
  setFuncs
    .map((func) => generateCommand(func, setNonFuncs, { parentCmd: "set", contract: "SetRegistry" }))
    .forEach((cmd) => setCmd.addCommand(cmd));

  // Relation command
  const relationCmd = program.command("relation").description("relation commands");
  const relationFuncs = loadAbiFunctions("IOmniRegistry").filter(startsWith("relation"));
  const relationNonFuncs = loadAbiNonFunctions("OmniRegistry");
  relationFuncs
    .map((func) => generateCommand(func, relationNonFuncs, { parentCmd: "relation", contract: "OmniRegistry" }))
    .forEach((cmd) => relationCmd.addCommand(cmd));

  // Unique command
  const uniqueCmd = program.command("unique").description("unique commands");
  const uniqueFuncs = loadAbiFunctions("IElementRegistry").filter(startsWith("unique"));
  const uniqueNonFuncs = loadAbiNonFunctions("ElementRegistry");
  uniqueFuncs
    .map((func) => generateCommand(func, uniqueNonFuncs, { parentCmd: "unique", contract: "ElementRegistry" }))
    .forEach((cmd) => uniqueCmd.addCommand(cmd));

  // Value command
  const valueCmd = program.command("value").description("value commands");
  const valueFuncs = loadAbiFunctions("IElementRegistry").filter(startsWith("value"));
  const valueNonFuncs = loadAbiNonFunctions("ElementRegistry");
  valueFuncs
    .map((func) => generateCommand(func, valueNonFuncs, { parentCmd: "value", contract: "ElementRegistry" }))
    .forEach((cmd) => valueCmd.addCommand(cmd));

  // Mintpolicy command
  const mintpolicyCmd = program.command("mintpolicy").description("mintpolicy commands");
  const mintpolicyFuncs = loadAbiFunctions("IObjectMinter");
  const mintpolicyNonFuncs = loadAbiNonFunctions("ObjectMinter");
  mintpolicyFuncs
    .map((func) => generateCommand(func, mintpolicyNonFuncs, { parentCmd: "mintpolicy", contract: "ObjectMinter" }))
    .forEach((cmd) => mintpolicyCmd.addCommand(cmd));

  // Object command
  const objectCmd = program.command("object").description("object commands");
  const objectFuncs = loadAbiFunctions("ISet");
  const objectNonFuncs = loadAbiNonFunctions("ISet");
  objectFuncs
    .map((func) => generateCommand(func, objectNonFuncs, { parentCmd: "object", contract: "ISet" }))
    .forEach((cmd) => objectCmd.addCommand(cmd));

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
