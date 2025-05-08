#!/usr/bin/env bun
import { Command } from "commander";
import { configureSubCommand } from "./commands";
import { CommandConfig } from "./types";

// Create the main program
const program = new Command()
  .name("every-cli")
  .description("CLI for interacting with Every Protocol contracts")
  .version("0.1.0");

// Define command configurations
const commandConfigs: CommandConfig[] = [
  {
    name: "kind",
    abiFile: "IKindRegistry.json",
    filter: () => true
  },
  {
    name: "set",
    abiFile: "ISetRegistry.json",
    filter: () => true
  },
  {
    name: "relation",
    abiFile: "IOmniRegistry.json",
    filter: (func) => func.name.startsWith("relation")
  },
  {
    name: "mintpolicy",
    abiFile: "IObjectMinter.json",
    filter: () => true
  },
  {
    name: "object",
    abiFile: "ISet.json",
    filter: () => true
  },
  {
    name: "unique",
    abiFile: "IElementRegistry.json",
    filter: (func) => func.name.startsWith("unique")
  },
  {
    name: "value",
    abiFile: "IElementRegistry.json",
    filter: (func) => func.name.startsWith("value")
  }
];

// Configure all commands
commandConfigs.forEach(config => {
  configureSubCommand(program, config);
});

// Parse command line arguments
program.parse();

// If no arguments provided, show help
if (process.argv.length <= 2) {
  program.help();
}
