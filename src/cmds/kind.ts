import { Argument, Command, Option } from "commander";
import { AbiFunctionDoc, getAbi, getFuncs } from "../abi2.js";
import { Address, PublicClient, SimulateContractParameters, toHex } from "viem";
import { coerceValue, readKindElements, toElementType, toRelationId } from "../utils.js";
import { outputOptions, writeOptions } from "../commander-patch.js";
import { submitSimulation } from "../ethereum.js";
import { Logger } from "../logger.js";
import { FromOpts } from "../from-opts.js";
import { AbiCommandConfig, genAbiCommand } from "../abicmd.js";
import { Universe } from "../config.js";
import { makeFuncName } from "../cmdgen.js";

const registerCmd = genRegisterCmd();
const updateCmd = genUpdateCmd();

const cmdConfig: AbiCommandConfig = {
  params: {
    ".rev0": () => new Option(`--rev <rev0>`).default(0),
    ".kindRev": () => new Option(`--krev <rev0>`).default(0),
    ".setRev": () => new Option(`--srev <rev0>`).default(0),
  },
  // eslint-disable-next-line
  prepare: (conf: Universe, client: PublicClient, args: any[]) => [
    conf.contracts.KindRegistry as Address,
    args,
    undefined,
  ],
};

const abiFuncs = getFuncs("IKindRegistry") as AbiFunctionDoc[];

const otherCmds = "upgrade,touch,transfer,owner,descriptor,snapshot".split(",").map((name) => {
  const funcName = makeFuncName(name, "kind");
  const abiFunc = abiFuncs.filter((i) => i.name == funcName)[0];
  return genAbiCommand(name, abiFunc, cmdConfig);
});

export const kindCmd = new Command("kind")
  .description("manage kinds")
  .addCommand(registerCmd)
  .addCommand(updateCmd)
  .addCommands(otherCmds);

function genRegisterCmd() {
  const funcName = "kindRegister";
  const abiFuncs = (getFuncs("IKindRegistry") as AbiFunctionDoc[]).filter((i) => i.name == funcName);
  const code = new Argument("<code>", "Matter hash of the kind code");
  const data = new Argument("<data>", "Matter hash of the kind data");
  const etys = new Option("--elements <ety...>", "Element types");
  const rels = new Option("--relations <rel...>", "IDs of relations supported");
  const options = [etys, rels, ...writeOptions, ...outputOptions];
  const args = [code, data];

  function resolveElementTypes(args: string[]): number[] {
    return args.length == 0
      ? []
      : args.length == 1 && /\.wasm$/i.test(args[0])
        ? readKindElements(args[0])
        : args.map(toElementType);
  }

  function getFuncArgs(cmd: Command) {
    const opts = cmd.opts();
    const etys = resolveElementTypes(opts.elements ?? []);
    const rels = (opts.relations ?? []).map(toRelationId);
    const args = cmd.args.map((arg: string, i: number) => coerceValue(arg, abiFuncs[0].inputs[i]));
    args.push(etys, rels);
    return args;
  }

  async function getCmdAction(this: Command) {
    const opts = this.opts();
    const args = getFuncArgs(this);
    const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
    const address = conf.contracts.KindRegistry as `0x${string}`;
    const account = walletClient.account;
    const simulation = {
      address,
      abi: getAbi("IKindRegistry"),
      functionName: funcName,
      args,
      account,
    } as SimulateContractParameters;
    await submitSimulation(simulation, publicClient, walletClient, new Logger(opts));
  }

  return new Command("register")
    .description("Register a new kind")
    .addOptions(options)
    .addArguments(args)
    .action(getCmdAction);
}

function genUpdateCmd() {
  // const funcName = "kindUpdate";
  // const abiFuncs = (abi.funcs.kindRegistry as AbiFunctionDoc[]).filter((i) => i.name == funcName);
  // const abiNonFuncs = abi.nonFuncs.kindRegistry;

  const code = new Option("--code <code>", "Matter hash of the kind code");
  const data = new Option("--data <data>", "Matter hash of the kind data");
  const rels = new Option("--relations [rel...]", "IDs of relations supported");
  const id = new Argument(`<id>`, "Kind id");
  const options = [code, data, rels, ...writeOptions, ...outputOptions];
  const args = [id];

  function getFuncArgs(cmd: Command) {
    const opts = cmd.opts();
    const args = [cmd.args[0]];
    const ZERO32 = toHex(0, { size: 32 });
    // let sig;
    if (opts.relations) {
      if (opts.code || opts.data) {
        // sig = "kindUpdate(uint64,bytes32,bytes32,uint64[])";
        args.push(opts.code ?? ZERO32);
        args.push(opts.data ?? ZERO32);
        args.push(typeof opts.relations == "boolean" ? [] : opts.relations);
      } else {
        // sig = "kindUpdate(uint64,uint64[])";
        args.push(typeof opts.relations == "boolean" ? [] : opts.relations);
      }
    } else {
      if (opts.code || opts.data) {
        // sig = "kindUpdate(uint64,bytes32,bytes32)";
        args.push(opts.code ?? ZERO32);
        args.push(opts.data ?? ZERO32);
      } else {
        throw new Error("");
      }
    }
    return args;
  }

  async function getCmdAction(this: Command) {
    const opts = this.opts();
    const args = getFuncArgs(this);
    const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
    const address = conf.contracts.KindRegistry as `0x${string}`;
    const account = walletClient.account;
    const simulation = {
      address,
      abi: getAbi("IKindRegistry"),
      functionName: "kindUpdate",
      args,
      account,
    } as SimulateContractParameters;
    await submitSimulation(simulation, publicClient, walletClient, new Logger(opts));
  }

  return new Command("update")
    .description("Update an existing kind")
    .addOptions(options)
    .addArguments(args)
    .action(getCmdAction);
}
