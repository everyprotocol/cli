import fs from "fs";
import path from "path";
import os from "os";
import { parse as parseTOML } from "@iarna/toml";
import * as TOML from "@iarna/toml";
import { OptionValues } from "commander";
import { __dirname } from "./utils.js";
// import { CamelCaseKeys } from "camelcase-keys";

export interface UniverseConfig {
  name: string;
  id: number;
  rpc: string;
  explorer: string;
  observer: string;

  contracts: Record<string, string>;
}

export interface EveryConfig {
  universes: Record<string, UniverseConfig>;
}

// export interface Universe {
//   name: string;
//   id: number;
//   rpc: string;
//   explorer: string;
//   observer: string;
//   contracts: {
//     setRegistry: string;
//     omniRegistry: string;
//     kindRegistry: string;
//     elementRegistry: string;
//     objectMinter: string;
//   };
// }

// export interface Observer {
//   name: string;
//   rpc: string;
//   explorer: string;
//   gateway: string;
// }

// export interface Config {
//   universes: Record<string, Universe>;
//   observers: Record<string, Observer>;
// }

import { z } from "zod";

export const ContractsSchema = z.object({
  SetRegistry: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Must be an Ethereum address"),
  OmniRegistry: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  KindRegistry: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  ElementRegistry: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  ObjectMinter: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

export const UniverseSchema = z.object({
  id: z.number().int().nonnegative(),
  rpc: z.string().url(),
  explorer: z.string().url(),
  observer: z.string(), // reference to an Observer key
  contracts: ContractsSchema,
});

export const ObserverSchema = z.object({
  rpc: z.string().url(),
  explorer: z.string().url(),
  gateway: z.string().url(),
});

export const ConfigSchema = z.object({
  universes: z.record(UniverseSchema),
  observers: z.record(ObserverSchema),
});

// Inferred TS types (optional, but handy)
export type Contracts = z.infer<typeof ContractsSchema>;
export type Universe = z.infer<typeof UniverseSchema>;
export type Observer = z.infer<typeof ObserverSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(file: string): Config {
  const text = fs.readFileSync(file, "utf8");
  const raw = TOML.parse(text);
  return ConfigSchema.parse(raw);
}

const configPaths = [
  path.resolve(__dirname, "../.every.toml"),
  path.resolve(os.homedir(), ".every.toml"),
  path.resolve(process.cwd(), ".every.toml"),
];

export function loadMergedConfig(): Config {
  const merged: Config = { universes: {}, observers: {} };
  const existingFiles = configPaths.filter((f) => fs.existsSync(f));

  if (existingFiles.length === 0) {
    throw new Error(`No config file found. Searched in:\n  ${configPaths.join("\n  ")}`);
  }

  for (const file of existingFiles) {
    const raw = loadConfig(file);

    if (raw.universes) {
      for (const [name, uni] of Object.entries(raw.universes)) {
        merged.universes[name] = {
          ...(merged.universes[name] ?? {}),
          ...(uni as object), // shallow merge here
        };
      }
    }

    if (raw.observers) {
      for (const [name, obs] of Object.entries(raw.observers)) {
        merged.observers[name] = {
          ...(merged.observers[name] ?? {}),
          ...(obs as object),
        };
      }
    }
  }

  return ConfigSchema.parse(merged);
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
