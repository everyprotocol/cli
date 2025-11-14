import { Argument, Option, Command } from "commander";
import { Address, PublicClient, SimulateContractParameters } from "viem";
import { parseAbiItem, type AbiFunction, type AbiParameter, erc1155Abi, erc721Abi } from "viem";
import { abi } from "../abi.js";
import { submitSimulation } from "../ethereum.js";
import { Logger } from "../logger.js";
import {
  parseAddress,
  parseBigInt,
  parseEther,
  parseHexData,
  parseInt,
  parseNode3,
  parseNode4,
  parseSID,
} from "../parsers.js";
import { Universe } from "../config.js";
import { FromOpts } from "../from-opts.js";
import { coerceValue } from "../utils.js";
import { outputOptions, universe as universeOption, writeOptions } from "../commander-patch.js";

const sidArg = new Argument("<sid>", "Object SID, in form of {set}.{id}").argParser(parseSID);
const tailArg = new Argument("<tail>", "Tail object, in form of [[data.]grant.]set.id").argParser(parseNode4);
const relArg = new Argument("<rel>", "Relation ID").argParser(parseBigInt);
const headArg = new Argument("<head>", "Head object, in form of [grant.]set.id").argParser(parseNode3);

export const objectCmd = new Command("object")
  .description("manage objects")
  .addCommand(genMintCmd())
  .addCommand(genUpgradeCmd())
  .addCommand(genTouchCmd())
  .addCommand(genTransferCmd())
  .addCommand(genSendCmd())
  .addCommand(genRelateCmd())
  .addCommand(genUnrelateCmd())
  .addCommand(genOwnerCmd())
  .addCommand(genDescriptorCmd())
  .addCommand(genSnapshotCmd())
  .addCommand(genUriCmd());

function genUpgradeCmd() {
  const cmdArgs = [sidArg];
  const cmdOpts = [
    new Option("--krev <rev>", "Upgrade kind to specified revison ").argParser(parseInt),
    new Option("--srev <rev>", "Upgrade set to specified revison").argParser(parseInt),
    ...writeOptions,
    ...outputOptions,
  ];

  async function action(this: Command) {
    const opts = this.opts();
    const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
    const { set, id } = this.processedArgs[0];

    const address = await getSetContract(set, publicClient, conf);
    const abi_ = [...abi.funcs.setContract, ...abi.nonFuncs.setContract];
    const functionName = "upgrade";
    const args = [id, opts.krev ?? 0, opts.srev ?? 0];
    const account = walletClient.account;

    const simulation = { address, abi: abi_, functionName, args, account } as SimulateContractParameters;
    await submitSimulation(simulation, publicClient, walletClient, new Logger(opts));
  }

  return new Command("upgrade")
    .description("Upgrade an object")
    .addArguments(cmdArgs)
    .addOptions(cmdOpts)
    .action(action);
}

function genTouchCmd() {
  const cmdArgs = [sidArg];
  const cmdOpts = [...writeOptions, ...outputOptions];

  async function action(this: Command) {
    const opts = this.opts();
    const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
    const { set, id } = this.processedArgs[0];

    const address = await getSetContract(set, publicClient, conf);
    const abi_ = [...abi.funcs.setContract, ...abi.nonFuncs.setContract];
    const functionName = "touch";
    const args = [id];
    const account = walletClient.account;

    const simulation = { address, abi: abi_, functionName, args, account } as SimulateContractParameters;
    await submitSimulation(simulation, publicClient, walletClient, new Logger(opts));
  }

  return new Command("touch").description("Touch an object").addArguments(cmdArgs).addOptions(cmdOpts).action(action);
}

function genTransferCmd() {
  const cmdArgs = [sidArg, new Argument("<to>", "Recipient address")];
  const cmdOpts = [...writeOptions, ...outputOptions];

  async function action(this: Command) {
    const opts = this.opts();
    const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
    const { set, id } = this.processedArgs[0];

    const address = await getSetContract(set, publicClient, conf);
    const abi_ = [...abi.funcs.setContract, ...abi.nonFuncs.setContract];
    const functionName = "transfer";
    const args = [id, this.processedArgs[1]];
    const account = walletClient.account;

    const simulation = { address, abi: abi_, functionName, args, account } as SimulateContractParameters;
    await submitSimulation(simulation, publicClient, walletClient, new Logger(opts));
  }

  return new Command("transfer")
    .description("Transfer an object")
    .addArguments(cmdArgs)
    .addOptions(cmdOpts)
    .action(action);
}

function genMintCmd() {
  const cmdArgs = [new Argument("<sid0>", "Object SID, in form of {set}.{id0}").argParser(parseSID)];
  const cmdOpts = [
    new Option("--to <address>", "Recipient address").argParser(parseAddress),
    new Option("--data <data>", "Extra mint data").argParser(parseHexData),
    new Option("--value <amount>", "Send an amount of ETH").argParser(parseEther),
    new Option("--minter", "Via ObjectMinter instead"),
    new Option("--policy <index>", "Index of the mint policy to search afterward").argParser(parseInt),
    new Option("--auth <data>", "Authorization data for permission").argParser(parseHexData),
    ...writeOptions,
    ...outputOptions,
  ];

  async function action(this: Command) {
    const opts = this.opts();
    const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
    const { set, id } = this.processedArgs[0];

    const account = walletClient.account;
    const to = opts.to ?? account?.address;
    const value = opts.value ?? 0;
    const data = opts.data ?? "0x";
    const functionName = "mint";
    let simulation;
    if (!opts.minter) {
      const address = await getSetContract(set, publicClient, conf);
      const args = [to, id, data];
      simulation = { address, abi: abi.setMint, functionName, args, value, account } as SimulateContractParameters;
    } else {
      const setAddress = await getSetContract(set, publicClient, conf);
      const address = conf.contracts.ObjectMinter as Address;
      const authData = opts.auth ?? "0x";
      const policy = opts.policy ?? 0;
      const args = [to, setAddress, id, data, authData, policy];
      simulation = { address, abi: abi.minterMint, functionName, args, value, account } as SimulateContractParameters;
    }
    await submitSimulation(simulation, publicClient, walletClient, new Logger(opts));
  }

  return new Command("mint").description("Mint an object").addArguments(cmdArgs).addOptions(cmdOpts).action(action);
}

function genSendCmd() {
  const cmdArgs = [
    new Argument("<sig>", "Signature, e.g. 'transfer(address,uint256)'"),
    new Argument("[args...]", "Arguments"),
  ];
  const cmdOpts = [
    new Option("--value <amount>", "the amount of ETH to send").argParser(parseEther),
    ...writeOptions,
    ...outputOptions,
  ];

  async function action(this: Command) {
    const opts = this.opts();
    const sig = this.processedArgs[0];

    const item = parseAbiItem(`function ${sig}`);
    if (item.type !== "function") throw new Error(`Not a function signature: ${sig}`);
    const abiFunc: AbiFunction = item as AbiFunction;
    const params = abiFunc.inputs ?? [];

    const args0 = this.args.slice(0);
    if (args0.length !== params.length)
      throw new Error(`Invalid argument count: expected ${params.length}, got ${args0.length}`);

    const sidPos = params.findIndex((p: AbiParameter) => p.type == "uint64");
    if (sidPos == -1) throw new Error("No uint64 found in signature");
    const { set, id } = parseSID(args0[sidPos]);
    args0[sidPos] = id.toString();
    const args = args0.map((a, i) => coerceValue(a, params[i]));

    const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
    const address = await getSetContract(set, publicClient, conf);
    const account = walletClient.account;
    const value = opts.value ?? 0;

    const simulation = {
      address,
      abi: [abiFunc, ...abi.nonFuncs.setContract, ...erc1155Abi, ...erc721Abi],
      functionName: abiFunc.name,
      args,
      account,
      value,
    } as SimulateContractParameters;
    await submitSimulation(simulation, publicClient, walletClient, new Logger(opts));
  }

  return new Command("send")
    .description("Send a transaction to set contract")
    .addArguments(cmdArgs)
    .addOptions(cmdOpts)
    .action(action);
}

function genOwnerCmd() {
  const cmdName = "owner";
  const cmdArgs = [sidArg];
  const cmdOpts = [universeOption, ...outputOptions];

  async function action(this: Command) {
    const opts = this.opts();
    const { set, id } = this.processedArgs[0];
    const { conf, publicClient } = FromOpts.toReadEthereum(opts);
    const address = await getSetContract(set, publicClient, conf);
    const args = [id];
    const abi_ = [...abi.funcs.setContract, ...abi.nonFuncs.setContract];
    const result = await publicClient.readContract({ address, abi: abi_, functionName: cmdName, args });
    const console = new Logger(opts);
    console.log(result);
    console.result(result);
  }

  return new Command("owner").description("Get object owner").addArguments(cmdArgs).addOptions(cmdOpts).action(action);
}

function genDescriptorCmd() {
  const cmdName = "descriptor";
  const cmdArgs = [sidArg];
  const cmdOpts = [
    new Option("--rev <rev>", "At the specified revision").argParser(parseInt),
    universeOption,
    ...outputOptions,
  ];

  async function action(this: Command) {
    const opts = this.opts();
    const { set, id } = this.processedArgs[0];
    const { conf, publicClient } = FromOpts.toReadEthereum(opts);
    const address = await getSetContract(set, publicClient, conf);
    const args = [id, opts.rev ?? 0];
    const abi_ = [...abi.funcs.setContract, ...abi.nonFuncs.setContract];
    const result = await publicClient.readContract({ address, abi: abi_, functionName: cmdName, args });
    const console = new Logger(opts);
    console.log(result);
    console.result(result);
  }

  return new Command("descriptor")
    .description("Get object descriptor")
    .addArguments(cmdArgs)
    .addOptions(cmdOpts)
    .action(action);
}

function genSnapshotCmd() {
  const cmdName = "snapshot";
  const cmdArgs = [sidArg];
  const cmdOpts = [
    new Option("--rev <rev>", "At the specified revision").argParser(parseInt),
    universeOption,
    ...outputOptions,
  ];

  async function action(this: Command) {
    const opts = this.opts();
    const { set, id } = this.processedArgs[0];
    const { conf, publicClient } = FromOpts.toReadEthereum(opts);
    const address = await getSetContract(set, publicClient, conf);
    const args = [id, opts.rev ?? 0];
    const abi_ = [...abi.funcs.setContract, ...abi.nonFuncs.setContract];
    const result = await publicClient.readContract({ address, abi: abi_, functionName: cmdName, args });
    const console = new Logger(opts);
    console.log(result);
    console.result(result);
  }

  return new Command("snapshot")
    .description("Get object snapshot")
    .addArguments(cmdArgs)
    .addOptions(cmdOpts)
    .action(action);
}

function genUriCmd() {
  const cmdName = "uri";
  const cmdArgs = [sidArg];
  const cmdOpts = [
    new Option("--rev <rev>", "At the specified revision").argParser(parseInt),
    universeOption,
    ...outputOptions,
  ];

  async function action(this: Command) {
    const opts = this.opts();
    const { set, id } = this.processedArgs[0];
    const { conf, publicClient } = FromOpts.toReadEthereum(opts);
    const address = await getSetContract(set, publicClient, conf);
    const args = [] as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    const abi_ = [...abi.funcs.setContract, ...abi.nonFuncs.setContract];
    const result0 = (await publicClient.readContract({
      address,
      abi: abi_,
      functionName: cmdName,
      args,
    })) as any as string; // eslint-disable-line @typescript-eslint/no-explicit-any

    const result = opts.rev ? interpolate(result0, id, opts.rev) : result0;
    const console = new Logger(opts);
    console.log(result);
    console.result(result);
  }

  return new Command("uri").description("Get object URI").addArguments(cmdArgs).addOptions(cmdOpts).action(action);
}

function genRelateCmd() {
  const cmdArgs = [tailArg, relArg, headArg];
  const cmdOpts = [...writeOptions, ...outputOptions];

  async function action(this: Command) {
    const opts = this.opts();
    const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
    const simulation = {
      address: conf.contracts.OmniRegistry as Address,
      abi: abi.relation,
      functionName: "relate",
      args: this.processedArgs,
      account: walletClient.account,
    } as SimulateContractParameters;
    await submitSimulation(simulation, publicClient, walletClient, new Logger(opts));
  }

  return new Command()
    .name("relate")
    .description("Link a tail object to a head object")
    .addArguments(cmdArgs)
    .addOptions(cmdOpts)
    .action(action);
}

function genUnrelateCmd() {
  const cmdArgs = [tailArg, relArg, headArg];
  const cmdOpts = [...writeOptions, ...outputOptions];

  async function action(this: Command) {
    const opts = this.opts();
    const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
    const simulation = {
      address: conf.contracts.OmniRegistry as Address,
      abi: abi.relation,
      functionName: "unrelate",
      args: this.processedArgs,
      account: walletClient.account,
    } as SimulateContractParameters;
    await submitSimulation(simulation, publicClient, walletClient, new Logger(opts));
  }

  return new Command()
    .name("unrelate")
    .description("Unlink a tail object from a head object")
    .addArguments(cmdArgs)
    .addOptions(cmdOpts)
    .action(action);
}

function interpolate(tmpl: string, id: bigint, rev: number) {
  return tmpl.replace(/\{id\}/g, String(id)).replace(/\{rev\}/g, String(rev));
}

async function getSetContract(set: bigint, publicClient: PublicClient, conf: Universe) {
  const address = await publicClient.readContract({
    address: conf.contracts.SetRegistry as Address,
    abi: abi.setContract,
    functionName: "setContract",
    args: [set],
  });
  return address as Address;
}
