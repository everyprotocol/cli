#!/usr/bin/env bun

import { Command } from "commander";
import { defineSubCommands, generateCommand, loadAbiFunctions, loadAbiNonFunctions } from "./autocmd";
import { CommandConfig, ContractFunction, CommandContext } from "./types";
import pkg from "../package.json" assert { type: "json" };

await main();

async function main() {
  const program = new Command()
    .name("every-cli")
    .description("CLI for interacting with Every Protocol contracts")
    .version(pkg.version);

  const kindCmd = program.command("kind").description("kind commands");
  const kindFuncs = loadAbiFunctions("IKindRegistry");
  const kindNonFuncs = loadAbiNonFunctions("KindRegistry");
  kindFuncs
    .map((func) => generateCommand(func, kindNonFuncs, { parentCmd: "kind", contract: "IKindRegistry" }))
    .forEach((cmd) => kindCmd.addCommand(cmd));

  // ai! rewrite the following code like the above

  const commandConfigs: CommandConfig[] = [
    { name: "kind", interface: "IKindRegistry", contract: "KindRegistry", rename: lstrip("kind") },
    { name: "set", interface: "ISetRegistry", contract: "SetRegistry", rename: lstrip("set") },
    {
      name: "relation",
      interface: "IOmniRegistry",
      contract: "OmniRegistry",
      filter: startsWith("relation"),
      rename: lstrip("relation"),
    },
    {
      name: "unique",
      interface: "IElementRegistry",
      contract: "ElementRegistry",
      filter: startsWith("unique"),
      rename: lstrip("unique"),
    },
    {
      name: "value",
      interface: "IElementRegistry",
      contract: "ElementRegistry",
      filter: startsWith("value"),
      rename: lstrip("value"),
    },
    { name: "mintpolicy", interface: "IObjectMinter", contract: "ObjectMinter" },
    { name: "object", interface: "ISet" },
  ];

  // Create level1 commands and add level2 commands to them
  commandConfigs.forEach((config) => {
    // Create the main command for this contract
    const level1Cmd = program.command(config.name).description(`${config.name} commands for ${config.interface}`);

    // Add level2 commands to the level1 command
    defineSubCommands(level1Cmd, config);
  });

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
