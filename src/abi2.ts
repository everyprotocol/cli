import { AbiFunction, AbiError, AbiEvent } from "abitype";
import { toFunctionSignature } from "viem";
import fs from "fs";
import path from "path";
import { memoize } from "lodash-es";
import { __dirname } from "./utils.js";

function getSelectorsInner() {
  return loadAbiFromFile("events-errors");
}

// export const getSelectors = memoize(getSelectorsInner);
export const getNonFuncs = memoize(getSelectorsInner);

function getFuncsInner(name: string) {
  return loadFuncAbiItems(name);
}

export const getFuncs = memoize(getFuncsInner);

function getAbiInner(name: string) {
  return [...getFuncs(name), ...getNonFuncs()];
}

export const getAbi = memoize(getAbiInner);

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadAbiFromFile(name: string): any {
  const file = path.resolve(__dirname, "../abis2", `${name}.json`);
  const content = fs.readFileSync(file, "utf8");
  return JSON.parse(content);
}

export function loadNonFuncAbiItems(name: string): AbiEventOrError[] {
  const abi = loadAbiFromFile(name);
  return ((abi.abi as unknown as { type: string }[]) || []).filter(
    (item) => item.type === "event" || item.type === "error"
  ) as unknown as AbiEventOrError[];
}

export function loadFuncAbiItems(name: string) {
  const abi = loadAbiFromFile(name);
  const metadata = abi.metadata?.output || {};
  const userMethods = metadata.userdoc?.methods || {};
  const devMethods = metadata.devdoc?.methods || {};
  return (
    abi.abi
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: any) => item.type === "function")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => {
        const signature = toFunctionSignature(item);
        const userdoc = userMethods[signature] || {};
        const devdoc = devMethods[signature] || {};
        const _metadata = {
          signature,
          ...devdoc,
          ...userdoc,
        };
        return {
          ...item,
          _metadata,
        } as AbiFunctionDoc;
      })
  );
}
