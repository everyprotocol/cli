import { AbiFunctionDoc } from "./types";
import fs from "fs";
import path from "path";
import { toFunctionSignature } from "viem";
import { FunctionCommand } from "./function-command";

interface SubCommands {
  kind: FunctionCommand[];
  set: FunctionCommand[];
  relation: FunctionCommand[];
  unique: FunctionCommand[];
  value: FunctionCommand[];
  object: FunctionCommand[];
  mintpolicy: FunctionCommand[];
}

const ORDER_MAP = new Map(
  "mint,register,update,upgrade,touch,transfer,relate,unrelate,owner,revision,descriptor,elements,sota,snapshot,status,uri"
    .split(",")
    .map((name, index) => [name, index])
);

function getPreferredOrder<T extends { name(): string }>(t: T): number {
  return ORDER_MAP.get(t.name()) ?? Infinity;
}

function byPreferredOrder<T extends { name(): string }>(a: T, b: T): number {
  const aIndex = ORDER_MAP.get(a.name()) ?? Infinity;
  const bIndex = ORDER_MAP.get(b.name()) ?? Infinity;
  return aIndex - bIndex;
}

function toCommand(contract: string, nonFuncs: AbiFunctionDoc[], getName?: (func: AbiFunctionDoc) => string) {
  return function (func: AbiFunctionDoc) {
    return new FunctionCommand().configure(contract, func, nonFuncs, getName);
  };
}

export function generateCommands(): SubCommands {
  const kindRegistryFuncs = loadFuncAbiItems("IKindRegistry");
  const setRegistryFuncs = loadFuncAbiItems("ISetRegistry");
  const omniRegistryFuncs = loadFuncAbiItems("IOmniRegistry");
  const elemRegistryFuncs = loadFuncAbiItems("IElementRegistry");
  const objectMinterFuncs = loadFuncAbiItems("IObjectMinter");
  const setContractFuncs = loadFuncAbiItems("ISet");
  const setRegistryAdminFuncs = loadFuncAbiItems("ISetRegistryAdmin");
  const objectMinterAdminFuncs = loadFuncAbiItems("IObjectMinterAdmin");

  const objectMinterNonFuncs = loadNonFuncAbiItems("ObjectMinter");
  const elemRegistryNonFuncs = loadNonFuncAbiItems("ElementRegistry");
  const omniRegistryNonFuncs = loadNonFuncAbiItems("OmniRegistry");
  const kindRegistryrNonFuncs = loadNonFuncAbiItems("KindRegistry");
  const setRegistryNonFuncs = loadNonFuncAbiItems("SetRegistry");

  const kind = kindRegistryFuncs
    .map(toCommand("KindRegistry", kindRegistryrNonFuncs, lstrip("kind")))
    .sort(byPreferredOrder);

  const set = [
    ...setRegistryAdminFuncs.map(toCommand("SetContract", setRegistryNonFuncs, rstrip("Set"))),
    ...setRegistryFuncs
      .filter(excludes(["setRegister", "setUpdate", "setTouch", "setUpgrade"]))
      .map(toCommand("SetRegistry", setRegistryNonFuncs, lstrip("set"))),
  ].sort(byPreferredOrder);

  const relation = omniRegistryFuncs
    .filter(startsWith("relation"))
    .map(toCommand("OmniRegistry", omniRegistryNonFuncs, lstrip("relation")))
    .sort(byPreferredOrder);

  const unique = elemRegistryFuncs
    .filter(startsWith("unique"))
    .map(toCommand("ElementRegistry", elemRegistryNonFuncs, lstrip("unique")))
    .sort(byPreferredOrder);

  const value = elemRegistryFuncs
    .filter(startsWith("value"))
    .map(toCommand("ElementRegistry", elemRegistryNonFuncs, lstrip("value")))
    .sort(byPreferredOrder);

  const object = [
    // mint functions
    ...objectMinterFuncs.filter(includes(["mint"])).map(toCommand("ObjectMinter", objectMinterNonFuncs)),
    // write functions
    ...setContractFuncs.filter(includes("update,upgrade,touch,transfer".split(","))).map(toCommand("SetContract", [])),
    // read functions
    ...setContractFuncs
      .filter(excludes("update,upgrade,touch,transfer,supportsInterface".split(",")))
      .map(toCommand("SetContract", [])),
    // relate/unrelate
    ...omniRegistryFuncs
      .filter(includes("relate,unrelate".split(",")))
      .map(toCommand("OmniRegistry", omniRegistryNonFuncs)),
  ].sort(byPreferredOrder);

  const mintpolicy = [
    ...objectMinterAdminFuncs.map(toCommand("SetContract", objectMinterNonFuncs, rstrip("MintPolicy"))),
    ...objectMinterFuncs
      .filter(startsWith("mintPolicy"))
      .filter(excludes("mintPolicyAdd,mintPolicyEnable,mintPolicyDisable".split(",")))
      .map(toCommand("ObjectMinter", objectMinterNonFuncs, lstrip("mintPolicy"))),
  ].sort(byPreferredOrder);

  return { kind, set, relation, unique, value, mintpolicy, object };
}

export function loadAbiFromFile(name: string): any {
  const file = path.resolve(__dirname, "../abis", `${name}.json`);
  const content = fs.readFileSync(file, "utf8");
  return JSON.parse(content);
}

export function loadFuncAbiItems(name: string) {
  let abi = loadAbiFromFile(name);
  const metadata = abi.metadata?.output || {};
  const userMethods = metadata.userdoc?.methods || {};
  const devMethods = metadata.devdoc?.methods || {};
  return abi.abi
    .filter((item: any) => item.type === "function")
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
    });
}

export function loadNonFuncAbiItems(name: string): AbiFunctionDoc[] {
  let abi = loadAbiFromFile(name);
  return (abi.abi || []).filter((item: any) => item.type == "error" || item.type == "event");
}

function lstrip(prefix: string) {
  return function (func: AbiFunctionDoc): string {
    return func.name.startsWith(prefix) ? func.name.substring(prefix.length).toLowerCase() : func.name;
  };
}

function rstrip(postfix: string) {
  return function (func: AbiFunctionDoc): string {
    return func.name.endsWith(postfix) ? func.name.slice(0, -postfix.length) : func.name;
  };
}

function startsWith(prefix: string) {
  return function (func: AbiFunctionDoc): boolean {
    return func.name.startsWith(prefix);
  };
}

function excludes(names: string[]) {
  return function (f: AbiFunctionDoc): boolean {
    return !names.includes(f.name);
  };
}

function includes(names: string[]) {
  return function (f: AbiFunctionDoc): boolean {
    return names.includes(f.name);
  };
}
