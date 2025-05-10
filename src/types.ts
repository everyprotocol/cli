export interface UniverseConfig {
  name: string;
  rpcUrl: string;
  contracts: Record<string, string>; // contractName -> address
}

export interface EveryConfig {
  universes: Record<string, UniverseConfig>;
}

export interface ContractFunction {
  /** Original ABI function object with standard fields */
  type: string;
  name: string;
  inputs: Array<{
    name: string;
    type: string;
    internalType: string;
    components?: any[];
  }>;
  outputs: Array<{
    name: string;
    type: string;
    internalType: string;
    components?: any[];
  }>;
  stateMutability: string;
  /** Merged metadata from userdoc and devdoc */
  _metadata?: {
    signature?: string;
    notice?: string;
    params?: Record<string, string>;
    returns?: Record<string, string>;
  };
}

export interface CommandConfig {
  name: string;
  interface: string;
  contract?: string;
  rename?: (func: string) => string;
  filter?: (func: ContractFunction) => boolean;
}
