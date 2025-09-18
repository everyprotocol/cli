import fs from "fs";
import path from "path";
import os from "os";
import * as TOML from "@iarna/toml";
import { z } from "zod";
import { __dirname } from "./utils.js";

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

export function loadMergedConfig(): Config {
  const [config] = _loadMergedConfig();
  return config;
}

export function _loadMergedConfig(): [Config, string[]] {
  const search = [
    ...new Set([
      path.resolve(__dirname, "../.every.toml"),
      path.resolve(os.homedir(), ".every.toml"),
      path.resolve(process.cwd(), ".every.toml"),
    ]),
  ];
  const files = search.filter((f) => fs.existsSync(f));
  if (files.length === 0) {
    throw new Error(`No config file found. Searched in:\n  ${search.join("\n  ")}`);
  }

  const merged: Config = { universes: {}, observers: {} };
  for (const file of files) {
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

  return [ConfigSchema.parse(merged), files];
}
