import { Argument, Command, Option } from "commander";
import { AbiParameter, Address, PublicClient, SimulateContractParameters } from "viem";
import { AbiFunctionDoc, getNonFuncs } from "./abi2.js";
import { coerceValue } from "./utils.js";
import { outputOptions, universe, writeOptions } from "./commander-patch.js";
import { submitSimulation } from "./ethereum.js";
import { Logger } from "./logger.js";
import { FromOpts } from "./from-opts.js";
import { Universe } from "./config.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ArgGetter = (cmd: Command) => any;

export type PrepareFn = (
  conf: Universe,
  client: PublicClient,
  args: any[], // eslint-disable-line @typescript-eslint/no-explicit-any,
  funcName?: string
) => [Address, any[], AbiFunctionDoc | undefined] | Promise<[Address, any[], AbiFunctionDoc | undefined]>; // eslint-disable-line @typescript-eslint/no-explicit-any

// export type ParamRewrite = (input: AbiParameter, desc: string) => Option | Argument;
export type ParamOverride = () => Option | Argument;

export type AbiCommandConfig = {
  prepare: PrepareFn;
  params?: Record<string, ParamOverride>;
  descs?: Record<string, string>;
};

export function genAbiCommand(cmdName: string, abiFunc: AbiFunctionDoc, cmdConf: AbiCommandConfig) {
  const { cmdArgs, cmdOpts, argGetters } = genAbiCommandParams(abiFunc, cmdConf.params);
  const desc = cmdConf.descs?.[`${abiFunc.name}`] ?? abiFunc._metadata.notice ?? "";
  return new Command(cmdName)
    .description(desc)
    .addArguments(cmdArgs)
    .addOptions(cmdOpts)
    .action(AbiCommandAction(abiFunc, argGetters, cmdConf.prepare));
}

function ArgGetterArg(i: number) {
  return function (cmd: Command) {
    return cmd.processedArgs[i];
  };
}

function ArgGetterOpt(name: string) {
  return function (cmd: Command) {
    return cmd.getOptionValue(name);
  };
}

export function ArgParser(input: AbiParameter) {
  // eslint-disable-next-line
  return function (value: string, previous: any): any {
    return coerceValue(value, input);
  };
}

function genAbiCommandParams(abiFunc: AbiFunctionDoc, params?: Record<string, ParamOverride>) {
  const cmdArgs = [] as Argument[];
  const cmdOpts = [] as Option[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const argGetters = [] as ((cmd: Command) => any)[];

  {
    const pfn = params?.[`${abiFunc.name}.PREPEND`] ?? params?.[`.PREPEND`];
    if (pfn) {
      const argOrOpt = pfn();
      if (argOrOpt instanceof Option) {
        cmdOpts.push(argOrOpt);
        argGetters.push(ArgGetterOpt(argOrOpt.name()));
      } else {
        const newLen = cmdArgs.push(argOrOpt);
        argGetters.push(ArgGetterArg(newLen - 1));
      }
    }
  }

  abiFunc.inputs.map((input) => {
    const name = input.name!;
    const pfn: ParamOverride =
      params?.[`${abiFunc.name}.${name!}`] ?? params?.[`.${name}`] ?? (() => new Argument(`<${name}>`));
    const argOrOpt = pfn();
    if (!hasDescription(argOrOpt)) {
      const desc = abiFunc._metadata?.params?.[name] || `parameter ${name}: ${input.type}`;
      argOrOpt.description = desc;
    }
    if (!hasArgParser(argOrOpt)) {
      argOrOpt.argParser(ArgParser(input));
    }
    if (argOrOpt instanceof Option) {
      cmdOpts.push(argOrOpt);
      argGetters.push(ArgGetterOpt(argOrOpt.name()));
    } else {
      const newLen = cmdArgs.push(argOrOpt);
      argGetters.push(ArgGetterArg(newLen - 1));
    }
  });

  if (abiFunc.stateMutability == "view" || abiFunc.stateMutability == "pure") {
    cmdOpts.push(universe, ...outputOptions);
  } else {
    cmdOpts.push(...writeOptions, ...outputOptions);
  }
  return { cmdArgs, cmdOpts, argGetters };
}

function AbiCommandReadAction(
  abiFunc: AbiFunctionDoc,
  argGetters: ((cmd: Command) => any)[], // eslint-disable-line @typescript-eslint/no-explicit-any
  contractGetter: PrepareFn
) {
  return async function action(this: Command) {
    const opts = this.opts();
    const console = new Logger(opts);
    const { conf, publicClient } = FromOpts.toReadEthereum(opts);
    const args0 = argGetters.map((getArg) => getArg(this));
    const [address, args, altAbiFunc] = await contractGetter(conf, publicClient, args0, abiFunc.name);
    const abiFuncFinal = altAbiFunc ?? abiFunc;
    const abi = [abiFuncFinal, ...getNonFuncs()];
    const result = await publicClient.readContract({ address, abi, functionName: abiFuncFinal.name, args });
    console.log(result);
    console.result(result);
  };
}

function AbiCommandWriteAction(abiFunc: AbiFunctionDoc, argGetters: ArgGetter[], prepare: PrepareFn) {
  return async function action(this: Command) {
    const opts = this.opts();
    const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
    const args0 = argGetters.map((getArg) => getArg(this));
    const [address, args, altAbiFunc] = await prepare(conf, publicClient, args0, abiFunc.name);
    const account = walletClient.account;
    const abiFuncFinal = altAbiFunc ?? abiFunc;
    const abi = [abiFuncFinal, ...getNonFuncs()];
    const sim = { address, abi, functionName: abiFuncFinal.name, args, account } as SimulateContractParameters;
    await submitSimulation(sim, publicClient, walletClient, new Logger(opts));
  };
}

function AbiCommandAction(abiFunc: AbiFunctionDoc, argGetters: ArgGetter[], prepare: PrepareFn) {
  return abiFunc.stateMutability == "view" || abiFunc.stateMutability == "pure"
    ? AbiCommandReadAction(abiFunc, argGetters, prepare)
    : AbiCommandWriteAction(abiFunc, argGetters, prepare);
}

function hasArgParser(obj: Argument | Option): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyObj = obj as any;
  return typeof anyObj._fn === "function" || typeof anyObj._argParser === "function";
}

function hasDescription(argOrOpt: Argument | Option): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof (argOrOpt as any).description === "string" && (argOrOpt as any).description.trim().length > 0;
}
