import { Command } from "commander";
import "@polkadot/api-augment/substrate";
import { submitSubTxUI } from "../substrate.js";
import { network } from "../commander-patch.js";
import { parseAccountId, parseBigInt } from "../parsers.js";
import { Logger } from "../logger.js";

const universeStartCmd = new Command("start")
  .description("Start a universe")
  .argument("<universe>", "Universe ID", parseBigInt)
  .argument("<horizon>", "Block number", parseBigInt)
  .argument("<herald>", "Herald address (SS58 or 0x hex)", parseAccountId)
  .addOption(network)
  .addKeystoreOptions()
  .addOutputOptions()
  .subWriteAction(async function (api, pair, universe, horizon, herald) {
    const call = api.tx.every.canonicalStart(universe, horizon, herald);
    const tx = api.tx.sudo.sudo(call);
    const console = new Logger(this.opts());
    await submitSubTxUI(api, tx, pair, console);
  });

export const universeCmd = new Command("universe").description("manage universes").addCommand(universeStartCmd);
