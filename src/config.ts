import fs from "fs";
import path from "path";
import os from "os";
import dotenv from "dotenv";
import { parse as parseTOML } from "@iarna/toml";
import type { EveryConfig, UniverseConfig } from "./types";
import { OptionValues } from "commander";

// Cache to avoid repeated loading
let universeConfigsCache: EveryConfig | null = null;

export function getUniverseConfig(opts: OptionValues): UniverseConfig {
  const config = loadUniverseConfigs();
  const universeName = opts.universe || "local";
  const universe = config.universes[universeName];

  if (!universe) {
    const availableUniverses = Object.keys(config.universes).join(", ");
    throw Error(`Universe "${universeName}" not found in configuration. Available universes: ${availableUniverses}`);
  }

  return universe;
}

function loadUniverseConfigs(): EveryConfig {
  if (universeConfigsCache) {
    return universeConfigsCache;
  }

  dotenv.config();
  const configs = new Map<string, UniverseConfig>();
  let configData: EveryConfig | null = null;

  // Load configs from files in order of precedence
  const configLocations = [
    path.resolve(process.cwd(), ".every.toml"),
    path.resolve(os.homedir(), ".every.toml"),
    path.resolve(process.cwd(), "node_modules/every-cli/.every.toml"),
  ];

  // Process TOML config files
  for (const configPath of configLocations) {
    if (fs.existsSync(configPath)) {
      try {
        const parsedConfig = parseTOML(fs.readFileSync(configPath, "utf8")) as any;

        if (configData) {
          // Merge with existing config
          if (parsedConfig.universes) {
            configData.universes = { ...configData.universes, ...parsedConfig.universes };
          }
          if (parsedConfig.general) {
            configData.general = { ...configData.general, ...parsedConfig.general };
          }
        } else {
          // First config found
          configData = {
            general: {
              default_universe: parsedConfig.general?.default_universe || "mainnet",
            },
            universes: parsedConfig.universes || {},
          };
        }
        console.log(`Loaded configuration from ${configPath}`);
      } catch (error) {
        console.warn(`Failed to load ${configPath}:`, error);
      }
    }
  }

  // Process loaded configuration
  if (configData?.universes) {
    for (const [name, universe] of Object.entries(configData.universes)) {
      configs.set(name, {
        name: universe.name,
        rpc_url: universe.rpc_url,
        contracts: universe.contracts || {},
      });
    }
  }

  if (configs.size === 0) {
    console.warn("No universe configurations found. Please create a .every.toml file.");
  }

  // Convert Map to EveryConfig format
  const defaultUniverse = "local";
  universeConfigsCache = {
    general: { default_universe: defaultUniverse },
    universes: Object.fromEntries(configs.entries()),
  };
  
  return universeConfigsCache;
}
