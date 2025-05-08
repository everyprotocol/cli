/**
 * Represents a function from a contract ABI with its documentation
 */
export interface ContractFunctionDetail {
  /** Original ABI function object */
  abiFunction: any;
  /** Function name */
  name: string;
  /** Function signature (name + param types) */
  signature: string;
  /** Function inputs */
  inputs: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  /** Function outputs */
  outputs: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  /** Function state mutability (view, pure, nonpayable, payable) */
  stateMutability: string;
  /** User-friendly description of the function */
  description: string;
  /** Contract name this function belongs to */
  contractName: string;
  /** Command path segments for nested commands */
  commandPath: string[];
}

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
