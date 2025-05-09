#!/usr/bin/env bun

import { Command } from "commander";
import { defineSubCommands } from "./autocmd";
import { CommandConfig, ContractFunction } from "./types";

await main();

// ai! read version from package.json
async function main() {
  const program = new Command()
    .name("every-cli")
    .description("CLI for interacting with Every Protocol contracts")
    .version("0.1.0");

  const commandConfigs: CommandConfig[] = [
    { name: "kind", intfAbi: "IKindRegistry", implAbi: "KindRegistry", rename: lstrip("kind") },
    { name: "set", intfAbi: "ISetRegistry", implAbi: "SetRegistry", rename: lstrip("set") },
    {
      name: "relation",
      intfAbi: "IOmniRegistry",
      implAbi: "OmniRegistry",
      filter: startsWith("relation"),
      rename: lstrip("relation"),
    },
    {
      name: "unique",
      intfAbi: "IElementRegistry",
      implAbi: "ElementRegistry",
      filter: startsWith("unique"),
      rename: lstrip("unique"),
    },
    {
      name: "value",
      intfAbi: "IElementRegistry",
      implAbi: "ElementRegistry",
      filter: startsWith("value"),
      rename: lstrip("value"),
    },
    { name: "mintpolicy", intfAbi: "IObjectMinter", implAbi: "ObjectMinter" },
    { name: "object", intfAbi: "ISet" },
  ];

  commandConfigs.forEach((config) => defineSubCommands(program, config));

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
