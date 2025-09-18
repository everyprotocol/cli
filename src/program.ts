import { Command } from "commander";
import { generateCommands } from "./cmdgen.js";
import { RenamingCommand } from "./cmds.js";
import { version } from "./utils.js";
import { walletCmd } from "./cmds/wallet.js";
import { matterCmd } from "./cmds/matter.js";
import { balanceCmd } from "./cmds/balance.js";
import { configCmd } from "./cmds/config.js";
import { objectSendCmd } from "./cmds/object.js";

function buildProgram() {
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
    .addCommands(subCmds.object)
    .addCommand(objectSendCmd);

  const mintPolicyCmd = new RenamingCommand()
    .name("minter")
    .description("manage mint policies")
    .addCommands(subCmds.mintpolicy);

  const program = new Command()
    .name("every")
    .description("CLI for interacting with Every Protocol")
    .version(version())
    .showHelpAfterError(true);

  program.addCommand(matterCmd);
  program.addCommand(setCmd);
  program.addCommand(kindCmd);
  program.addCommand(relationCmd);
  program.addCommand(valueCmd);
  program.addCommand(uniqueCmd);
  program.addCommand(objectCmd);
  program.addCommand(mintPolicyCmd);
  program.addCommand(balanceCmd);
  program.addCommand(walletCmd);
  program.addCommand(configCmd);

  return program;
}

export const program = buildProgram();
