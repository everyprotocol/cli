// ai! move ContractFunctionDetail to this file

import type { ContractFunctionDetail } from "./autocmd";

export interface CommandConfig {
  name: string;
  abiFile: string;
  rename?: (func: string) => string;
  filter: (func: ContractFunctionDetail) => boolean;
}

export interface UniverseConfig {
  name: string;
  rpcUrl: string;
  contracts: Record<string, string>; // contractName -> address
}

export interface EveryConfig {
  general: {
    // ai! defaultUniverse => default_universe
    defaultUniverse: string;
  };
  universes: Record<
    string,
    {
      name: string;
      rpc_url: string;
      contracts: Record<string, string>;
    }
  >;
}
