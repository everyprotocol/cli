import fs from "fs";
import path from "path";
import os from "os";
import { parse as parseTOML } from "@iarna/toml";
import { OptionValues } from "commander";
import { __dirname } from "./utils.js";

export interface UniverseConfig {
  name: string;
  id: number;
  rpc: string;
  explorer: string;
  observer: {
    rpc: string;
    explorer: string;
    gateway: string;
  };
  contracts: Record<string, string>;
}

export interface EveryConfig {
  universes: Record<string, UniverseConfig>;
}

// Cache
let CONFIG_CACHED: EveryConfig | null = null;

export function getUniverseConfig(opts: OptionValues): UniverseConfig {
  const config = loadProtocolConfig();
  const universeName = opts.universe || "local";
  const universe = config.universes[universeName];
  if (!universe) {
    const available = Object.keys(config.universes).join(", ");
    throw new Error(`Universe "${universeName}" not found. Available: ${available}`);
  }
  return universe;
}

function loadProtocolConfig(): EveryConfig {
  if (CONFIG_CACHED) return CONFIG_CACHED;

  const configPaths = new Set([
    path.resolve(__dirname, "../.every.toml"),
    path.resolve(os.homedir(), ".every.toml"),
    path.resolve(process.cwd(), ".every.toml"),
  ]);

  const mergedConfig: EveryConfig = {
    universes: {},
  };

  for (const configPath of configPaths) {
    if (!fs.existsSync(configPath)) continue;

    try {
      const raw = fs.readFileSync(configPath, "utf8");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = parseTOML(raw) as any;
      if (parsed.universes) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const [name, uni] of Object.entries<any>(parsed.universes)) {
          // console.log(name, uni);
          mergedConfig.universes[name] = {
            name: name,
            id: uni.id,
            rpc: uni.rpc,
            explorer: uni.explorer,
            observer: uni.observer,
            contracts: uni.contracts || {},
          };
        }
      }
      console.log(`Loaded configuration from ${configPath}`);
    } catch (err) {
      console.warn(`Failed to load ${configPath}:`, err);
    }
  }

  if (Object.keys(mergedConfig.universes).length === 0) {
    console.warn("No universe configurations found");
  }

  CONFIG_CACHED = mergedConfig;
  return CONFIG_CACHED;
}
