import { Argument, Command, Option } from "commander";
import { abi, AbiFunctionDoc } from "../abi.js";
import { Universe } from "../config.js";
import { getCommandGen, makeFuncName } from "../cmdgen.js";
import { Address, SimulateContractParameters, toHex } from "viem";
import { coerceValue, readKindElements, toElementType, toRelationId } from "../utils.js";
import { outputOptions, writeOptions } from "../commander-patch.js";
import { submitSimulation } from "../ethereum.js";
import { Logger } from "../logger.js";
import { FromOpts } from "../from-opts.js";

const genKindCmd = getCommandGen({
  getFuncName: (cmdName: string) => makeFuncName(cmdName, `kind`),
  getAbiFuncs: (funcName: string) => (abi.funcs.kindRegistry as AbiFunctionDoc[]).filter((i) => i.name == funcName),
  // eslint-disable-next-line
  getAbiNonFuncs: (funcName: string) => abi.nonFuncs.kindRegistry,
  // eslint-disable-next-line
  getContract: (conf: Universe, args: any[], abiFunc: AbiFunctionDoc) => conf.contracts.KindRegistry as Address,
});

const registerCmd = genRegisterCmd();
const updateCmd = genUpdateCmd();
const otherCmds = "upgrade,touch,transfer,owner,descriptor,snapshot".split(",").map(genKindCmd);

export const kindCmd = new Command("kind")
  .description("manage kinds")
  .addCommand(registerCmd)
  .addCommand(updateCmd)
  .addCommands(otherCmds);

function genRegisterCmd() {
  const funcName = "kindRegister";
  const abiFuncs = (abi.funcs.kindRegistry as AbiFunctionDoc[]).filter((i) => i.name == funcName);
  const abiNonFuncs = abi.nonFuncs.kindRegistry;

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

  async function getCmdAction(cmd: Command) {
    const opts = cmd.opts();
    const args = getFuncArgs(cmd);
    const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
    const address = conf.contracts.KindRegistry as `0x${string}`;
    const account = walletClient.account;
    const simulation = {
      address,
      abi: [...abiFuncs, ...abiNonFuncs],
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
  const funcName = "kindUpdate";
  const abiFuncs = (abi.funcs.kindRegistry as AbiFunctionDoc[]).filter((i) => i.name == funcName);
  const abiNonFuncs = abi.nonFuncs.kindRegistry;

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
    let sig;
    if (opts.relations) {
      if (opts.code || opts.data) {
        sig = "kindUpdate(uint64,bytes32,bytes32,uint64[])";
        args.push(opts.code ?? ZERO32);
        args.push(opts.data ?? ZERO32);
        args.push(typeof opts.relations == "boolean" ? [] : opts.relations);
      } else {
        sig = "kindUpdate(uint64,uint64[])";
        args.push(typeof opts.relations == "boolean" ? [] : opts.relations);
      }
    } else {
      if (opts.code || opts.data) {
        sig = "kindUpdate(uint64,bytes32,bytes32)";
        args.push(opts.code ?? ZERO32);
        args.push(opts.data ?? ZERO32);
      } else {
        throw new Error("");
      }
    }
    const abiFunc = abiFuncs.filter((f) => f._metadata.signature == sig)[0];
    return [args, abiFunc];
  }

  async function getCmdAction(cmd: Command) {
    const opts = cmd.opts();
    const [args, abiFunc] = getFuncArgs(cmd);
    const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
    const address = conf.contracts.KindRegistry as `0x${string}`;
    const account = walletClient.account;
    const simulation = {
      address,
      abi: [abiFunc, ...abiNonFuncs],
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
