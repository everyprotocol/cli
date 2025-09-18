import { Command } from "commander";
import { _loadMergedConfig } from "../config.js";

const configShowCmd = new Command("show").description("show merged configuration").action(async () => {
  const [config] = _loadMergedConfig();
  console.log(JSON.stringify(config, null, 2));
});

const configFilesCmd = new Command("files").description("list configuration files used").action(async () => {
  const [, files] = _loadMergedConfig();
  files.forEach((f) => console.log(f));
});

export const configCmd = new Command("config")
  .description("view merged configuration and source files")
  .addCommand(configShowCmd)
  .addCommand(configFilesCmd);
