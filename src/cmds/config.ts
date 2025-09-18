import { Command } from "commander";
import { _loadMergedConfig } from "../config.js";

export const configCmd = new Command("config").description("view merged configuration and source files");

configCmd
  .command("show")
  .description("show merged configuration")
  .action(async () => {
    const [config] = _loadMergedConfig();
    console.log(JSON.stringify(config, null, 2));
  });

configCmd
  .command("files")
  .description("list configuration files used")
  .action(async () => {
    const [, files] = _loadMergedConfig();
    files.forEach((f) => console.log(f));
  });
