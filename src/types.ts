import { AbiFunction, AbiError, AbiEvent } from "abitype";

export interface UniverseConfig {
  name: string;
  rpcUrl: string;
  contracts: Record<string, string>;
}

export interface EveryConfig {
  universes: Record<string, UniverseConfig>;
}

export interface FunctionDoc {
  signature: string;
  notice?: string;
  params?: Record<string, string>;
  returns?: Record<string, string>;
}

export interface AbiFunctionDoc extends AbiFunction {
  _metadata: FunctionDoc;
}

export type AbiEventOrError = AbiError | AbiEvent;
