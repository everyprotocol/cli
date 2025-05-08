/**
 * Represents a function from a contract ABI with its documentation
 */
export interface ContractFunctionDetail {
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

  // ai! remove the following 3 fields
  /** Additional fields for CLI processing */
  signature: string;
  contractName: string;
  commandPath: string[];

  /** Merged metadata from userdoc and devdoc */
  _metadata?: {
    signature: string; // ai! add this, andd use import { getFunctionSignature } from 'viem' to calculate the signature with the standard abi fields
    notice?: string;
    params?: Record<string, string>;
    returns?: Record<string, string>;
  };
}

export interface CommandConfig {
  name: string;
  abiFile: string;
  rename?: (func: string) => string;
  filter?: (func: ContractFunctionDetail) => boolean;
}

export interface UniverseConfig {
  name: string;
  rpcUrl: string;
  contracts: Record<string, string>; // contractName -> address
}

export interface EveryConfig {
  general: {
    default_universe: string;
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
