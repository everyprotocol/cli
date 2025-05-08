import fs from "fs";
import path from "path";
import os from "os";
import dotenv from "dotenv";
import { parse as parseTOML } from "@iarna/toml";
import type { EveryConfig, UniverseConfig } from "./types";
import { OptionValues } from "commander";

// ai! refactor, simplify and be concise

// Cache for universe configs to avoid repeated loading
let universeConfigsCache: Map<string, UniverseConfig> | null = null;

export function getUniverseConfig(opts: OptionValues): UniverseConfig {
  const configs = loadUniverseConfigs();
  const config = configs.get(opts.universe);
  if (!config) throw Error();
  return config;
}

/**
 * Load universe configurations from config files and environment
 * @returns Map of universe configurations
 */
export function loadUniverseConfigs(): Map<string, UniverseConfig> {
  // Return cached config if available
  if (universeConfigsCache) {
    return universeConfigsCache;
  }

  // Load environment variables from .env file if it exists
  dotenv.config();

  const configs = new Map<string, UniverseConfig>();
  let configData: EveryConfig | null = null;

  // Define possible config file locations in order of precedence
  const configLocations = [
    path.resolve(process.cwd(), ".every.toml"), // Current directory
    path.resolve(os.homedir(), ".every.toml"), // User's home directory
    path.resolve(process.cwd(), "node_modules/every-cli/.every.toml"), // Package default
  ];

  // Try to load from config files in order of precedence
  for (const configPath of configLocations) {
    if (fs.existsSync(configPath)) {
      try {
        const configContent = fs.readFileSync(configPath, "utf8");
        const parsedConfig = parseTOML(configContent) as any;

        // If we already have a config, merge this one into it
        if (configData) {
          // Merge universes
          if (parsedConfig.universes) {
            configData.universes = {
              ...configData.universes,
              ...parsedConfig.universes,
            };
          }

          // Override general settings
          if (parsedConfig.general) {
            configData.general = {
              ...configData.general,
              ...parsedConfig.general,
            };
          }
        } else {
          // First config found, use it as base
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

  // Also try to load from legacy config.json for backward compatibility
  try {
    const jsonConfigPath = path.resolve(process.cwd(), "config.json");
    if (fs.existsSync(jsonConfigPath)) {
      const jsonConfig = JSON.parse(fs.readFileSync(jsonConfigPath, "utf8"));

      // If we don't have a config yet, create one
      if (!configData) {
        configData = {
          general: { default_universe: "mainnet" },
          universes: {},
        };
      }

      // Add universes from JSON config
      if (jsonConfig.universes) {
        for (const [name, universe] of Object.entries(jsonConfig.universes)) {
          const u = universe as any;
          configData.universes[name] = {
            name: u.name,
            rpc_url: u.rpcUrl,
            contracts: u.contracts || {},
          };
        }
      }

      console.log(`Loaded configuration from ${jsonConfigPath}`);
    }
  } catch (error) {
    console.warn("Failed to load config.json:", error);
  }

  // Process the loaded configuration
  if (configData && configData.universes) {
    for (const [name, universe] of Object.entries(configData.universes)) {
      configs.set(name, {
        name: universe.name,
        rpc_url: universe.rpc_url,
        contracts: universe.contracts || {},
      });
    }
  }

  // Add environment-based configuration if available (highest precedence)
  const envUniverseName = process.env.UNIVERSE_NAME;
  const envRpcUrl = process.env.RPC_URL;

  if (envUniverseName && envRpcUrl) {
    // Extract contract addresses from environment variables
    // Format: CONTRACT_ADDRESS_<CONTRACT_NAME>=0x...
    const contracts: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith("CONTRACT_ADDRESS_") && value) {
        const contractName = key.replace("CONTRACT_ADDRESS_", "");
        contracts[contractName] = value;
      }
    }

    configs.set(envUniverseName, {
      name: envUniverseName,
      rpc_url: envRpcUrl,
      contracts,
    });

    console.log(`Added environment-based configuration for universe "${envUniverseName}"`);
  }

  if (configs.size === 0) {
    console.warn("No universe configurations found. Please create a .every.toml file.");
  }

  // Cache the configs for future use
  universeConfigsCache = configs;
  return configs;
}
