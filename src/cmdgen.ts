import { AbiFunctionDoc } from "./abi.js";
import { Address, createPublicClient, http, parseAbi } from "viem";
import { CommandContext, configureCommand, CommandConfig } from "./cmds.js";
import JSON5 from "json5";
import { rstrip, excludes, includes, lstrip, startsWith, checkArguments } from "./utils.js";
import { loadNonFuncAbiItems, loadFuncAbiItems, replaceAbiParamAt, insertAbiParamAt } from "./abi.js";
import { Command } from "commander";
import { genMintCommand } from "./mint.js";

interface SubCommands {
  kind: Command[];
  set: Command[];
  relation: Command[];
  unique: Command[];
  value: Command[];
  object: Command[];
  mintpolicy: Command[];
}

const objectMinterNonFuncs = loadNonFuncAbiItems("ObjectMinter");
const elemRegistryNonFuncs = loadNonFuncAbiItems("ElementRegistry");
const omniRegistryNonFuncs = loadNonFuncAbiItems("OmniRegistry");
const kindRegistryrNonFuncs = loadNonFuncAbiItems("KindRegistry");
const setRegistryNonFuncs = loadNonFuncAbiItems("SetRegistry");

const kindRegistryFuncs = loadFuncAbiItems("IKindRegistry");
const setRegistryFuncs = loadFuncAbiItems("ISetRegistry");
const omniRegistryFuncs = loadFuncAbiItems("IOmniRegistry");
const elemRegistryFuncs = loadFuncAbiItems("IElementRegistry");
const objectMinterFuncs = loadFuncAbiItems("IObjectMinter");
const setContractFuncs = loadFuncAbiItems("ISet");
const setRegistryAdminFuncs = loadFuncAbiItems("ISetRegistryAdmin");
const objectMinterAdminFuncs = loadFuncAbiItems("IObjectMinterAdmin");

export const readSetContractAbi = [
  ...parseAbi(["function setContract(uint64 id) external view returns (address code)"]),
  ...setRegistryNonFuncs,
];

export const mintAbi = [
  ...parseAbi([
    "function mint(address to, address set, uint64 id, bytes memory data, bytes memory auth, uint32 policy) payable",
  ]),
  ...objectMinterNonFuncs,
];

export function generateCommands(): SubCommands {
  const kind = kindRegistryFuncs
    .map(AbiToCommand({ contract: "KindRegistry", nonFuncs: kindRegistryrNonFuncs, cmdName: lstrip("kind") }))
    .sort(byPreferredOrder);

  const set = [
    ...setRegistryAdminFuncs.map(AbiToCommand(setRegistryAdminCmdConfig)),
    ...setRegistryFuncs
      .filter(excludes(["setRegister", "setUpdate", "setTouch", "setUpgrade"]))
      .map(AbiToCommand({ contract: "SetRegistry", nonFuncs: setRegistryNonFuncs, cmdName: lstrip("set") })),
  ].sort(byPreferredOrder);

  const relation = omniRegistryFuncs
    .filter(startsWith("relation"))
    .map(
      AbiToCommand({
        contract: "OmniRegistry",
        nonFuncs: omniRegistryNonFuncs,
        cmdName: lstrip("relation"),
      })
    )
    .sort(byPreferredOrder);

  const unique = elemRegistryFuncs
    .filter(startsWith("unique"))
    .map(AbiToCommand({ contract: "ElementRegistry", nonFuncs: elemRegistryNonFuncs, cmdName: lstrip("unique") }))
    .sort(byPreferredOrder);

  const value = elemRegistryFuncs
    .filter(startsWith("value"))
    .map(AbiToCommand({ contract: "ElementRegistry", nonFuncs: elemRegistryNonFuncs, cmdName: lstrip("value") }))
    .sort(byPreferredOrder);

  const object = [
    genMintCommand(),
    // mint functions
    // ...objectMinterFuncs
    //   .filter(includes(["mint"]))
    //   .map(AbiToCommand({ contract: "ObjectMinter", nonFuncs: objectMinterNonFuncs })),
    // write functions
    ...setContractFuncs
      .filter(includes("update,upgrade,touch,transfer".split(",")))
      .map(AbiToCommand(setContractObjectCmdConfig)),
    // read functions
    ...setContractFuncs
      .filter(excludes("update,upgrade,touch,transfer,uri,supportsInterface".split(",")))
      .map(AbiToCommand(setContractObjectCmdConfig)),
    ...setContractFuncs
      .filter(includes("uri".split(",")))
      .map(AbiToCommand({ ...setContractObjectCmdConfig, txnPrepare: objectUriTxnPrepare })),
    // relate/unrelate
    ...omniRegistryFuncs
      .filter(includes("relate,unrelate".split(",")))
      .map(AbiToCommand({ contract: "OmniRegistry", nonFuncs: omniRegistryNonFuncs })),
  ].sort(byPreferredOrder);

  const mintpolicy = [
    ...objectMinterAdminFuncs.map(AbiToCommand(objectMinterAdminCmdConfig)),
    ...objectMinterFuncs
      .filter(startsWith("mintPolicy"))
      .filter(excludes("mintPolicyAdd,mintPolicyEnable,mintPolicyDisable".split(",")))
      .map(AbiToCommand({ contract: "ObjectMinter", nonFuncs: objectMinterNonFuncs, cmdName: lstrip("mintPolicy") })),
  ].sort(byPreferredOrder);

  return { kind, set, relation, unique, value, mintpolicy, object };
}

const setContractObjectCmdConfig: CommandConfig = {
  contract: "ISet",
  nonFuncs: [],
  cmdAbi: function (txnAbi: AbiFunctionDoc): AbiFunctionDoc {
    return replaceAbiParamAt(txnAbi, 0, {
      name: "sid",
      type: "string",
      doc: "Scoped Object ID (in form of set.id, e.g., 17.1)",
    });
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  txnPrepare: async function (ctx: CommandContext): Promise<{ address: Address; tag: string; args: any[] }> {
    const rawArgs = checkArguments(ctx.cmd.args, ctx.cmdAbi);
    const [set, id] = rawArgs[0].split(".");
    const args = [JSON5.parse(id), ...rawArgs.slice(1)];
    const publicClient = createPublicClient({ transport: http(ctx.conf.rpcUrl) });
    const address = (await publicClient.readContract({
      address: ctx.conf.contracts["SetRegistry"] as Address,
      abi: readSetContractAbi,
      functionName: "setContract",
      args: [set],
    })) as Address;
    return { address: address as Address, tag: ctx.contract, args };
  },
};

const objectUriTxnPrepare = async function (ctx: CommandContext): Promise<{
  address: Address;
  tag: string;
  args: /* eslint-disable-line @typescript-eslint/no-explicit-any */ any[];
}> {
  const rawArgs = checkArguments(ctx.cmd.args, ctx.cmdAbi);
  // const [set, id] = rawArgs[0].split(".");
  const set = rawArgs[0].split(".")[0];
  const publicClient = createPublicClient({ transport: http(ctx.conf.rpcUrl) });
  const address = (await publicClient.readContract({
    address: ctx.conf.contracts["SetRegistry"] as Address,
    abi: readSetContractAbi,
    functionName: "setContract",
    args: [set],
  })) as Address;
  return { address: address as Address, tag: ctx.contract, args: [] };
};

const setRegistryAdminCmdConfig: CommandConfig = {
  contract: "ISetRegistryAdmin",
  nonFuncs: setRegistryNonFuncs,
  cmdName: rstrip("Set"),
  cmdAbi: function (txnAbi: AbiFunctionDoc): AbiFunctionDoc {
    return insertAbiParamAt(txnAbi, 0, {
      name: "contract",
      type: "address",
      doc: "address of the set contract",
    });
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  txnPrepare: async function (ctx: CommandContext): Promise<{ address: Address; tag: string; args: any[] }> {
    const raw = checkArguments(ctx.cmd.args, ctx.cmdAbi);
    const address = raw[0] as Address;
    const args = raw.slice(1);
    return { address, tag: ctx.contract, args };
  },
};

const objectMinterAdminCmdConfig: CommandConfig = {
  contract: "IObjectMinterAdmin",
  nonFuncs: objectMinterNonFuncs,
  cmdName: rstrip("MintPolicy"),
  cmdAbi: function (txnAbi: AbiFunctionDoc): AbiFunctionDoc {
    return insertAbiParamAt(txnAbi, 0, {
      name: "contract",
      type: "address",
      doc: "address of the contract",
    });
  },
  txnPrepare: async function (ctx: CommandContext): Promise<{
    address: Address;
    tag: string;
    args: /* eslint-disable-line @typescript-eslint/no-explicit-any */ any[];
  }> {
    const raw = checkArguments(ctx.cmd.args, ctx.cmdAbi);
    const address = raw[0] as Address;
    const args = raw.slice(1);
    return { address, tag: ctx.contract, args };
  },
};

function AbiToCommand(conf: CommandConfig) {
  return (txnAbi: AbiFunctionDoc) => configureCommand(txnAbi, conf);
}

function byPreferredOrder<T extends { name(): string }>(a: T, b: T): number {
  const ORDER_MAP = new Map(
    "mint,register,update,upgrade,touch,transfer,relate,unrelate,owner,descriptor,elements,revision,sota,snapshot,status,admint,contract,rule,uri"
      .split(",")
      .map((name, index) => [name, index])
  );
  const aIndex = ORDER_MAP.get(a.name()) ?? Infinity;
  const bIndex = ORDER_MAP.get(b.name()) ?? Infinity;
  return aIndex - bIndex;
}
