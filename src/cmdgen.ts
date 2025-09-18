import { Address, createPublicClient, http } from "viem";
import { Command } from "commander";
import JSON5 from "json5";
import { CommandContext, configureCommand, CommandConfig } from "./cmds.js";
import { rstrip, excludes, includes, lstrip, startsWith, checkArguments } from "./utils.js";
import { replaceAbiParamAt, insertAbiParamAt, abi, AbiFunctionDoc } from "./abi.js";
import { genMintCommand } from "./cmds/mint.js";
import { genRelateCommand, genUnrelateCommand } from "./relate.js";

interface SubCommands {
  kind: Command[];
  set: Command[];
  relation: Command[];
  unique: Command[];
  value: Command[];
  object: Command[];
  mintpolicy: Command[];
}

export function generateCommands(): SubCommands {
  const kind = abi.funcs.kindRegistry
    .map(AbiToCommand({ contract: "KindRegistry", nonFuncs: abi.nonFuncs.kindRegistry, cmdName: lstrip("kind") }))
    .sort(byPreferredOrder);

  const set = [
    ...abi.funcs.setRegistryAdmin.map(AbiToCommand(setRegistryAdminCmdConfig)),
    ...abi.funcs.setRegistry
      .filter(excludes(["setRegister", "setUpdate", "setTouch", "setUpgrade"]))
      .map(AbiToCommand({ contract: "SetRegistry", nonFuncs: abi.nonFuncs.setRegistry, cmdName: lstrip("set") })),
  ].sort(byPreferredOrder);

  const relation = abi.funcs.omniRegistry
    .filter(startsWith("relation"))
    .map(
      AbiToCommand({
        contract: "OmniRegistry",
        nonFuncs: abi.nonFuncs.omniRegistry,
        cmdName: lstrip("relation"),
      })
    )
    .sort(byPreferredOrder);

  const unique = abi.funcs.elemRegistry
    .filter(startsWith("unique"))
    .map(AbiToCommand({ contract: "ElementRegistry", nonFuncs: abi.nonFuncs.elemRegistry, cmdName: lstrip("unique") }))
    .sort(byPreferredOrder);

  const value = abi.funcs.elemRegistry
    .filter(startsWith("value"))
    .map(AbiToCommand({ contract: "ElementRegistry", nonFuncs: abi.nonFuncs.elemRegistry, cmdName: lstrip("value") }))
    .sort(byPreferredOrder);

  const object = [
    genMintCommand(),
    genRelateCommand(),
    genUnrelateCommand(),
    // write functions
    ...abi.funcs.setContract
      .filter(includes("update,upgrade,touch,transfer".split(",")))
      .map(AbiToCommand(setContractObjectCmdConfig)),
    // read functions
    ...abi.funcs.setContract
      .filter(excludes("update,upgrade,touch,transfer,uri,supportsInterface".split(",")))
      .map(AbiToCommand(setContractObjectCmdConfig)),
    ...abi.funcs.setContract
      .filter(includes("uri".split(",")))
      .map(AbiToCommand({ ...setContractObjectCmdConfig, txnPrepare: objectUriTxnPrepare })),
  ].sort(byPreferredOrder);

  const mintpolicy = [
    ...abi.funcs.objectMinterAdmin.map(AbiToCommand(objectMinterAdminCmdConfig)),
    ...abi.funcs.objectMinter
      .filter(startsWith("mintPolicy"))
      .filter(excludes("mintPolicyAdd,mintPolicyEnable,mintPolicyDisable".split(",")))
      .map(
        AbiToCommand({ contract: "ObjectMinter", nonFuncs: abi.nonFuncs.objectMinter, cmdName: lstrip("mintPolicy") })
      ),
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
    const publicClient = createPublicClient({ transport: http(ctx.conf.rpc) });
    const address = (await publicClient.readContract({
      address: ctx.conf.contracts["SetRegistry"] as Address,
      abi: abi.setContract,
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
  const publicClient = createPublicClient({ transport: http(ctx.conf.rpc) });
  const address = (await publicClient.readContract({
    address: ctx.conf.contracts["SetRegistry"] as Address,
    abi: abi.setContract,
    functionName: "setContract",
    args: [set],
  })) as Address;
  return { address: address as Address, tag: ctx.contract, args: [] };
};

const setRegistryAdminCmdConfig: CommandConfig = {
  contract: "ISetRegistryAdmin",
  nonFuncs: abi.nonFuncs.setRegistry,
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
  nonFuncs: abi.nonFuncs.objectMinter,
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
