import { Command } from "commander";
import { version } from "./utils.js";
import { walletCmd } from "./cmds/wallet.js";
import { matterCmd } from "./cmds/matter.js";
import { balanceCmd } from "./cmds/balance.js";
import { configCmd } from "./cmds/config.js";
import { kindCmd } from "./cmds/kind.js";
import { valueCmd } from "./cmds/value.js";
import { uniqueCmd } from "./cmds/unique.js";
import { relationCmd } from "./cmds/relation.js";
import { setCmd } from "./cmds/set.js";
import { objectCmd } from "./cmds/object.js";
import { minterCmd } from "./cmds/minter.js";
import { universeCmd } from "./cmds/universe.js";

export const program = new Command("every")
  .description("CLI for interacting with Every Protocol")
  .version(version())
  .showHelpAfterError(true)
  .addCommand(universeCmd)
  .addCommand(matterCmd)
  .addCommand(setCmd)
  .addCommand(kindCmd)
  .addCommand(relationCmd)
  .addCommand(valueCmd)
  .addCommand(uniqueCmd)
  .addCommand(objectCmd)
  .addCommand(minterCmd)
  .addCommand(balanceCmd)
  .addCommand(walletCmd)
  .addCommand(configCmd);
