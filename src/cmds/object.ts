import { Argument, Command } from "commander";
import { Address, createPublicClient, http, parseUnits, SimulateContractParameters } from "viem";
import { parseAbiItem, type AbiFunction, type AbiParameter, erc1155Abi, erc721Abi } from "viem";
import { abi, AbiFunctionDoc } from "../abi.js";
import { submitSimulation } from "../ethereum.js";
import { Logger } from "../logger.js";
import { parseBigInt, parseNode3, parseNode4 } from "../parsers.js";
import { Universe } from "../config.js";
import { CommandGenConfig, CommandGenDefaults, getCommandGen } from "../cmdgen.js";
import { FromOpts } from "../from-opts.js";
import { coerceValue } from "../utils.js";

const objectRelateCmd = new Command()
  .name("relate")
  .description("Link a tail object to a head object through a relation")
  .addWriteOptions()
  .argument("<tail>", "tail node, in form of [[data.]grant.]set.id", parseNode4)
  .argument("<rel>", "relation ID", parseBigInt)
  .argument("<head>", "head node in form of [grant.]set.id, ", parseNode3)
  .action(async function () {
    await relateAction(this, "relate");
  });

const objectUnrelateCmd = new Command()
  .name("unrelate")
  .description("Unlinks a tail object from a head object")
  .addWriteOptions()
  .argument("<tail>", "tail node, in form of [[data.]grant.]set.id", parseNode4)
  .argument("<rel>", "relation ID", parseBigInt)
  .argument("<head>", "head node in form of [grant.]set.id, ", parseNode3)
  .action(async function () {
    await relateAction(this, "unrelate");
  });

const objectMintCmd = new Command()
  .name("mint")
  .description("Mint an object via the object minter or directly from the set")
  .option("--to <address>", "specify the recipient")
  .option("--value <amount>", "the amount of ETH to send together", "0")
  .option("--auth <data>", "authorization data for a permissioned mint", "0x")
  .option("--policy <index>", "the index number of the mint policy", "0")
  .option("--no-minter", "mint directly from set contract instead of using ObjectMinter")
  .addWriteOptions()
  .argument("<sid>", "scoped object ID, in form of set.id (e.g., 17.1)")
  .argument("[data]", "additional input data", "0x")
  .action(mintAction);

const objectSendCmd = new Command("send")
  .description("Call a function by signature (dry-run: prints calldata)")
  .option("--sig <sig>", "Function signature, e.g. 'transfer(address,uint256)'")
  .argument("<args...>", "Function arguments (arrays/tuples as JSON)")
  .addWriteOptions()
  .action(sendAction);

const cmdGenConfig: CommandGenConfig = {
  getFuncName: (cmdName: string) => cmdName,
  getAbiFuncs: (funcName: string) => (abi.funcs.setContract as AbiFunctionDoc[]).filter((i) => i.name == funcName),
  // eslint-disable-next-line
  getAbiNonFuncs: (funcName: string) => [...abi.nonFuncs.setContract],
  // eslint-disable-next-line
  getContract: async function (conf: Universe, args: any[], abiFunc: AbiFunctionDoc) {
    const publicClient = createPublicClient({ transport: http(conf.rpc) });
    const address = await publicClient.readContract({
      address: conf.contracts.SetRegistry as Address,
      abi: abi.setContract,
      functionName: "setContract",
      args: [args[0].set],
    });
    return address as Address;
  },
  // eslint-disable-next-line
  getFuncArgs: function (args: any[], abiFunc: AbiFunctionDoc) {
    return abiFunc.name == "uri" ? args.slice(1) : [args[0].id, ...args.slice(1)];
  },
  getCmdArgs: function (abiFunc: AbiFunctionDoc) {
    const sid = new Argument(`<sid>`, "sid of the object");
    const args0 = CommandGenDefaults.getCmdArgs(abiFunc);
    return abiFunc.name == "uri" ? [sid] : [sid, ...args0.slice(1)];
  },
};

const cmdGen = getCommandGen(cmdGenConfig);

const writeCmds = "upgrade,touch,transfer".split(",");
const readCmds = "owner,descriptor,snapshot,uri".split(",");

export const objectCmd = new Command("object")
  .description("manage objects")
  .addCommands(writeCmds.map(cmdGen))
  .addCommand(objectMintCmd)
  .addCommand(objectRelateCmd)
  .addCommand(objectUnrelateCmd)
  .addCommand(objectSendCmd)
  .addCommands(readCmds.map(cmdGen));

async function mintAction(this: Command) {
  const opts = this.opts();
  const args0 = this.args;
  const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
  const setRegistry = conf.contracts["SetRegistry"] as Address;
  const account = walletClient.account;
  const [set, id] = args0[0].split(".");
  const setContract = (await publicClient.readContract({
    address: setRegistry,
    abi: abi.setContract,
    functionName: "setContract",
    args: [BigInt(set)],
  })) as Address;
  const value = parseUnits(opts.value || "0", 18);
  const recipientAddress = (opts.to || account!.address) as Address;
  const mintData = (args0[1] || "0x") as `0x${string}`;
  const simulation = opts.minter
    ? ({
        address: conf.contracts["ObjectMinter"] as Address,
        abi: abi.mint,
        functionName: "mint",
        args: [recipientAddress, setContract, BigInt(id), mintData, opts.auth || "0x", Number(opts.policy || "0")],
        account,
        value,
      } as SimulateContractParameters)
    : ({
        address: setContract,
        abi: abi.create,
        functionName: "create",
        args: [recipientAddress, BigInt(id), mintData],
        account,
        value,
      } as SimulateContractParameters);
  await submitSimulation(simulation, publicClient, walletClient, new Logger(opts));
}

async function relateAction(cmd: Command, functionName: string) {
  const opts = cmd.opts();
  const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
  const address = conf.contracts["OmniRegistry"] as Address;
  const simulation = {
    address,
    abi: abi.relation,
    functionName,
    args: cmd.args,
    account: walletClient.account,
  } as SimulateContractParameters;
  await submitSimulation(simulation, publicClient, walletClient, new Logger(opts));
}

async function sendAction(this: Command) {
  const opts = this.opts();
  const args0 = this.args;
  const { sig } = this.opts<{ sig?: string }>();
  if (!sig) {
    console.error("Error: --sig is required (e.g. --sig 'transfer(address,uint256)')");
    this.exitOverride();
    return;
  }
  const item = parseAbiItem(`function ${sig}`);
  if (item.type !== "function") throw new Error(`Not a function signature: ${sig}`);
  const abiFunc: AbiFunction = item as AbiFunction;
  const params = abiFunc.inputs ?? [];
  if (args0.length !== params.length)
    throw new Error(`Argument count mismatch: expected ${params.length}, got ${args0.length}`);
  const sidIndex = params.findIndex((p: AbiParameter) => p.type == "uint64");
  if (sidIndex == -1) throw new Error("SID type(uint64) not found in signature");
  const [setId, objectId] = args0[sidIndex].split(".");
  args0[sidIndex] = objectId;
  const args = args0.map((a, i) => coerceValue(a, params[i]));
  const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
  const setRegistry = conf.contracts["SetRegistry"] as Address;
  const account = walletClient.account;
  const setContract = (await publicClient.readContract({
    address: setRegistry,
    abi: abi.funcs.setRegistry,
    functionName: "setContract",
    args: [BigInt(setId)],
  })) as Address;
  const value = parseUnits(opts.value ?? "0", 18);

  const simulation = {
    address: setContract,
    abi: [abiFunc, ...abi.nonFuncs.setContract, ...erc1155Abi, ...erc721Abi],
    functionName: abiFunc.name,
    args: args,
    account,
    value,
  } as SimulateContractParameters;
  await submitSimulation(simulation, publicClient, walletClient, new Logger(opts));
}
