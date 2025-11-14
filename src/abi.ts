import { AbiFunction, AbiError, AbiEvent, parseAbi } from "abitype";
import { toFunctionSignature } from "viem";
import { AbiParameter } from "viem";
import fs from "fs";
import path from "path";
import { omit } from "lodash-es";
import { __dirname } from "./utils.js";

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

export const abi = {
  nonFuncs: {
    objectMinter: loadNonFuncAbiItems("ObjectMinter"),
    elemRegistry: loadNonFuncAbiItems("ElementRegistry"),
    omniRegistry: loadNonFuncAbiItems("OmniRegistry"),
    kindRegistry: loadNonFuncAbiItems("KindRegistry"),
    setRegistry: loadNonFuncAbiItems("SetRegistry"),
    setContract: loadNonFuncAbiItems("ISet"),
  },

  funcs: {
    kindRegistry: loadFuncAbiItems("IKindRegistry"),
    setRegistry: loadFuncAbiItems("ISetRegistry"),
    omniRegistry: loadFuncAbiItems("IOmniRegistry"),
    elemRegistry: loadFuncAbiItems("IElementRegistry"),
    objectMinter: loadFuncAbiItems("IObjectMinter"),
    setContract: loadFuncAbiItems("ISet"),
    setRegistryAdmin: loadFuncAbiItems("ISetRegistryAdmin"),
    objectMinterAdmin: loadFuncAbiItems("IObjectMinterAdmin"),
  },

  setContract: [
    ...parseAbi(["function setContract(uint64 id) external view returns (address code)"]),
    ...loadNonFuncAbiItems("SetRegistry"),
  ],

  minterMint: [
    ...parseAbi([
      "function mint(address to, address set, uint64 id, bytes memory data, bytes memory auth, uint32 policy) payable",
    ]),
    ...loadNonFuncAbiItems("ObjectMinter"),
    ...loadNonFuncAbiItems("ISet"),
  ],

  setMint: [
    ...parseAbi(["function mint(address to, uint64 id0, bytes calldata data) payable"]),
    ...loadNonFuncAbiItems("ISet"),
  ],

  relation: [
    ...parseAbi([
      "function relate(uint256 tail, uint64 rel, uint256 head)",
      "function unrelate(uint256 tail, uint64 rel, uint256 head)",
    ]),
    ...loadNonFuncAbiItems("OmniRegistry"),
  ],
};

export function removeAbiParamByName(abi: AbiFunctionDoc, name: string): AbiFunctionDoc {
  const inputs = abi.inputs.filter((p) => p.name !== name);
  return rebuildFunctionDoc(abi, inputs, omit(abi._metadata.params, [name]));
}

export function removeAbiParamAt(abi: AbiFunctionDoc, index: number): AbiFunctionDoc {
  const name = abi.inputs[index].name!;
  const inputs = abi.inputs.filter((p, i) => i != index);
  return rebuildFunctionDoc(abi, inputs, omit(abi._metadata.params, [name]));
}

export function replaceAbiParamAt(
  abi: AbiFunctionDoc,
  index: number,
  { name, type, doc }: { name: string; type: string; doc?: string }
): AbiFunctionDoc {
  const inputs = [...abi.inputs.slice(0, index), { type, name, internalType: type }, ...abi.inputs.slice(index + 1)];
  const paramDocs = { ...abi._metadata.params, ...(doc ? { [name]: doc } : {}) };
  return rebuildFunctionDoc(abi, inputs, paramDocs);
}

export function insertAbiParamAt(
  abi: AbiFunctionDoc,
  index: number,
  { name, type, doc }: { name: string; type: string; doc?: string }
): AbiFunctionDoc {
  const inputs = [...abi.inputs.slice(0, index), { type, name, internalType: type }, ...abi.inputs.slice(index)];
  const paramDocs = { ...abi._metadata.params, ...(doc ? { [name]: doc } : {}) };
  return rebuildFunctionDoc(abi, inputs, paramDocs);
}

export function rebuildFunctionDoc(
  abi: AbiFunctionDoc,
  inputs: AbiParameter[],
  paramDocs: Record<string, string>
): AbiFunctionDoc {
  return {
    ...abi,
    inputs,
    _metadata: {
      ...abi._metadata,
      signature: toFunctionSignature({ ...abi, inputs }),
      params: paramDocs,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadAbiFromFile(name: string): any {
  const file = path.resolve(__dirname, "../abis", `${name}.json`);
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
