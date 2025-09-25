import { Command } from "commander";
import { _loadMergedConfig } from "../config.js";

const configShowCmd = new Command("show")
  .description("show mreged configuration")
  .option("-u, --universe <universe>", "Show config of this universe only")
  .option("-n, --network <network>", "Show config of this network only")
  .action(async (opts) => {
    const [config] = _loadMergedConfig();
    const universe = opts.universe
      ? (config.universes?.[opts.universe] ??
        (() => {
          throw new Error(`config for universe ${opts.universe} not found`);
        })())
      : undefined;

    const network = opts.network
      ? (config.observers?.[opts.network] ??
        (() => {
          throw new Error(`config for network ${opts.network} not found`);
        })())
      : undefined;

    let result;
    if (universe && !network) {
      result = universe;
    } else if (network && !universe) {
      result = network;
    } else if (universe && network) {
      result = {
        [opts.universe]: universe,
        [opts.network]: network,
      };
    } else {
      result = config;
    }

    console.log(JSON.stringify(result, null, 2));
  });

const configFilesCmd = new Command("files").description("list configuration files searched").action(async () => {
  const [, files] = _loadMergedConfig();
  files.forEach((f) => console.log(f));
});

export const configCmd = new Command("config")
  .description("view merged configuration and source files")
  .addCommand(configShowCmd)
  .addCommand(configFilesCmd);
