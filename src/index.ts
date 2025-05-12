#!/usr/bin/env bun

import { Command } from "commander";
import pkg from "../package.json" assert { type: "json" };
import { RenamingCommand } from "./renaming-command";
import { generateCommands } from "./cmdgen";

async function main() {
  const subCmds = generateCommands();
  const kindCmd = new RenamingCommand().name("kind").description("manage kinds").addCommands(subCmds.kind);
  const setCmd = new RenamingCommand().name("set").description("manage sets").addCommands(subCmds.set);
  const relationCmd = new RenamingCommand()
    .name("relation")
    .description("manage relations")
    .addCommands(subCmds.relation);
  const uniqueCmd = new RenamingCommand().name("unique").description("manage uniques").addCommands(subCmds.unique);
  const valueCmd = new RenamingCommand().name("value").description("manage values").addCommands(subCmds.value);
  const objectCmd = new RenamingCommand()
    .name("object")
    .description("create and interact with objects")
    .addCommands(subCmds.object);
  const mintPolicyCmd = new RenamingCommand()
    .name("mintpolicy")
    .description("manage mint policies")
    .addCommands(subCmds.mintpolicy);

  const program = new Command()
    .name("every")
    .description("CLI for interacting with Every Protocol")
    .version(pkg.version)
    .showHelpAfterError(true);
  program.addCommand(kindCmd);
  program.addCommand(setCmd);
  program.addCommand(relationCmd);
  program.addCommand(uniqueCmd);
  program.addCommand(valueCmd);
  program.addCommand(objectCmd);
  program.addCommand(mintPolicyCmd);

  try {
    await program.parseAsync();
  } catch (e: any) {
    console.error(e.message);
  }
}

await main();
