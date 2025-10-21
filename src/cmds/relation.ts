import { Argument, Command, Option } from "commander";
import { Address, pad, padHex, SimulateContractParameters } from "viem";
import fs from "node:fs";
import { abi, AbiFunctionDoc } from "../abi.js";
import { Universe } from "../config.js";
import { getCommandGen, makeFuncName } from "../cmdgen.js";
import { coerceValue, j11Parse, stringify } from "../utils.js";
import { outputOptions, writeOptions } from "../commander-patch.js";
import { submitSimulation } from "../ethereum.js";
import { Logger } from "../logger.js";
import { FromOpts } from "../from-opts.js";
import { parseEnum, RelationOwnerShift, RelationTerminator } from "../enums.js";

const genRelationCmd = getCommandGen({
  getFuncName: (cmdName: string) => makeFuncName(cmdName, `relation`),
  getAbiFuncs: (funcName: string) => (abi.funcs.omniRegistry as AbiFunctionDoc[]).filter((i) => i.name == funcName),
  // eslint-disable-next-line
  getAbiNonFuncs: (funcName: string) => abi.nonFuncs.omniRegistry,
  // eslint-disable-next-line
  getContract: (conf: Universe, args: any[], abiFunc: AbiFunctionDoc) => conf.contracts.OmniRegistry as Address,
  // eslint-disable-next-line
  getFuncArgs: (args: any[], abiFunc: AbiFunctionDoc) => args,
});

const registerCmd = genRegisterCmd();
const updateCmd = genUpdateCmd();
const otherCmds = "upgrade,touch,transfer,owner,descriptor,snapshot,rule,admit".split(",").map(genRelationCmd);

export const relationCmd = new Command("relation")
  .description("manage relations")
  .addCommand(registerCmd)
  .addCommand(updateCmd)
  .addCommands(otherCmds);

function genRegisterCmd() {
  const funcName = "relationRegister";
  const abiFuncs = (abi.funcs.omniRegistry as AbiFunctionDoc[]).filter((i) => i.name == funcName);
  const abiNonFuncs = abi.nonFuncs.omniRegistry;

  const data = new Argument("<data>", "Matter hash of the relation data");
  const rule = new Argument("<rule>", "Relation rule");
  const adjs = new Argument("<adjs...>", "Relation adjacencies");
  const options = [...writeOptions, ...outputOptions];
  const args = [data, rule, adjs];

  function getFuncArgs(cmd: Command) {
    const code = pad("0x", { size: 20 });
    const data = cmd.processedArgs[0];
    const rule = stringify(resolveRule(cmd.processedArgs[1]));
    const adjs = stringify(resolveAdjs(cmd.processedArgs[2]));
    const args = [code, data, rule, adjs].map((arg, i) => coerceValue(arg, abiFuncs[0].inputs[i]));
    return args;
  }

  async function getCmdAction(this: Command) {
    const opts = this.opts();
    const args = getFuncArgs(this);
    const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
    const address = conf.contracts.OmniRegistry as `0x${string}`;
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
    .description("Register a new relation")
    .addOptions(options)
    .addArguments(args)
    .action(getCmdAction);
}

function genUpdateCmd() {
  const funcName = "relationUpdate";
  const abiFuncs = (abi.funcs.omniRegistry as AbiFunctionDoc[]).filter((i) => i.name == funcName);
  // console.log(abiFuncs);
  const abiNonFuncs = abi.nonFuncs.omniRegistry;

  const rel = new Argument("<rel>", "Relation ID");
  const data = new Argument("<data>", "Matter hash of the relation data");
  const adjs = new Option("--adjs <adjacency...>", "Relation adjacencies");
  const options = [adjs, ...writeOptions, ...outputOptions];
  const args = [rel, data];

  function getFuncArgs(cmd: Command) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = cmd.opts() as any;
    let args = [cmd.processedArgs[0], cmd.processedArgs[1]];
    let sig = "relationUpdate(uint64,bytes32)";
    if (opts.adjs) {
      sig = "relationUpdate(uint64,bytes32,(uint16,uint48)[])";
      const adjs = stringify(resolveAdjs(opts.adjs));
      args.push(adjs);
    }
    const abiFunc = abiFuncs.find((i) => i._metadata.signature == sig);
    if (!abiFunc) {
      throw new Error(`signature ${sig} not found in abi`);
    }
    args = args.map((arg, i) => coerceValue(arg, abiFunc!.inputs[i]));
    return { args, sig, abiFunc };
  }

  async function getCmdAction(this: Command) {
    const opts = this.opts();
    const { args } = getFuncArgs(this);
    const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
    const address = conf.contracts.OmniRegistry as `0x${string}`;
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

  return new Command("update")
    .description("Update an existing relation")
    .addOptions(options)
    .addArguments(args)
    .action(getCmdAction);
}

const U48_MAX = (1n << 48n) - 1n;
const DEG_MAX = 0x7fff;
const AT_LEAST_ONE_FLAG = 0x8000;

type Adjacency = { degs: number; kind: bigint };

type RelationRule = {
  version: number;
  relateShift: number;
  terminator: number;
  unrelateShift: number;
  unrelateDelay: bigint;
  extra: `0x${string}`;
};

function resolveAdjs(args: string[]): Adjacency[] {
  const kind = (s: string): bigint => {
    if (/^other$/i.test(s)) return 0n;
    if (/^total$/i.test(s)) return U48_MAX;
    const n = BigInt(s);
    if (n < 0n || n > U48_MAX) throw new Error("kind out of range");
    return n;
  };

  const degs = (s: string): number => {
    const plus = s.endsWith("+"),
      t = plus ? s.slice(0, -1) : s,
      n = Number(t);
    if (!/^\d+$/.test(t) || n < 0 || n > DEG_MAX) throw new Error("degs out of range");
    return plus ? n | AT_LEAST_ONE_FLAG : n;
  };

  return args.map((s) => {
    const [k, d] = s.split(":");
    if (!k || !d) throw new Error(`bad "${s}"`);
    return { kind: kind(k.trim()), degs: degs(d.trim()) };
  });
}

type RelationRuleInput = {
  version?: number; // default 1
  relateShift: number | keyof typeof RelationOwnerShift;
  terminator: number | keyof typeof RelationTerminator;
  unrelateShift: number | keyof typeof RelationOwnerShift;
  unrelateDelay?: bigint | number; // default 0
  extra?: `0x${string}`; // default '0x' -> padded to bytes20
};

function resolveRule(arg: string) {
  const json = arg.startsWith("@") ? fs.readFileSync(arg.slice(1), "utf8") : arg;
  const input = j11Parse(json) as RelationRuleInput;
  return {
    version: input.version ?? 1,
    relateShift: parseEnum(input.relateShift, RelationOwnerShift, "relateShift"),
    terminator: parseEnum(input.terminator, RelationTerminator, "terminator"),
    unrelateShift: parseEnum(input.unrelateShift, RelationOwnerShift, "unrelateShift"),
    unrelateDelay: input.unrelateDelay ?? 0,
    extra: padHex(input.extra ?? "0x", { size: 20 }),
  } as RelationRule;
}
