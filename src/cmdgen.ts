import { Argument, Command } from "commander";
import { Address, createPublicClient, http, SimulateContractParameters } from "viem";
import { AbiEventOrError, AbiFunctionDoc } from "./abi.js";
import { submitSimulation } from "./ethereum.js";
import { Logger } from "./logger.js";
import { outputOptions, universe, writeOptions } from "./commander-patch.js";
import { Universe } from "./config.js";
import { FromOpts } from "./from-opts.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getReadAction = (config: CommandGenConfig, funName: string, abiFunc: AbiFunctionDoc, abi: any) =>
  async function readAction(this: Command) {
    const opts = this.opts();
    const conf = FromOpts.getUniverseConfig(opts);
    const address = await config.getContract(conf, this.args, abiFunc);
    const args = (config.getFuncArgs ?? CommandGenDefaults.getFuncArgs)(this.args, abiFunc);
    const console = new Logger(opts);
    const publicClient = createPublicClient({ transport: http(conf.rpc) });
    const result = await publicClient.readContract({ address, abi, functionName: funName, args });
    console.log(result);
    console.result(result);
  };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getWriteAction = (config: CommandGenConfig, funcName: string, abiFunc: AbiFunctionDoc, abi: any) =>
  async function writeAction(this: Command) {
    const opts = this.opts();
    const args = (config.getFuncArgs ?? CommandGenDefaults.getFuncArgs)(this.args, abiFunc);
    const { publicClient, walletClient, conf } = await FromOpts.toWriteEthereum(opts);
    const address = config.getContract(conf, this.args, abiFunc);
    const account = walletClient.account;
    const simulation = { address, abi, functionName: funcName, args, account } as SimulateContractParameters;
    await submitSimulation(simulation, publicClient, walletClient, new Logger(opts));
  };

export const getCommandGen = (config: CommandGenConfig) =>
  function genCmd(cmdName: string) {
    const { getFuncName, getAbiFuncs, getAbiNonFuncs } = config;
    const funcName = getFuncName(cmdName);
    const abiFuncs = getAbiFuncs(funcName);
    const abiNonFuncs = getAbiNonFuncs(funcName);
    // console.log(funcName, abiFuncs);
    const abiFuncDoc = abiFuncs[0];
    const description = abiFuncDoc._metadata?.notice || "";
    const isRead = abiFuncDoc.stateMutability == "view" || abiFuncDoc.stateMutability == "pure";
    const options = isRead ? [universe, ...outputOptions] : [...writeOptions, ...outputOptions];
    const args = (config.getCmdArgs ?? CommandGenDefaults.getCmdArgs)(abiFuncDoc);

    const abiContract = [...abiFuncs, ...abiNonFuncs];
    const action = isRead
      ? getReadAction(config, funcName, abiFuncDoc, abiContract)
      : getWriteAction(config, funcName, abiFuncDoc, abiContract);
    return new Command(cmdName).description(description).addOptions(options).addArguments(args).action(action);
  };

export function makeFuncName(cmdName: string, prefix: string) {
  return `${prefix}${cmdName[0].toUpperCase()}${cmdName.slice(1)}`;
}

export interface CommandGenConfig {
  getFuncName: (cmdName: string) => string;
  getAbiFuncs: (funcName: string) => AbiFunctionDoc[];
  getAbiNonFuncs: (funcName: string) => AbiEventOrError[];
  getContract: (conf: Universe, args: any[], abiFunc: AbiFunctionDoc) => Promise<Address> | Address; // eslint-disable-line
  getFuncArgs?: (args: any[], abiFunc: AbiFunctionDoc) => any[]; // eslint-disable-line
  getCmdArgs?: (abiFunc: AbiFunctionDoc) => Argument[];
}

export const CommandGenDefaults = {
  getFuncArgs: (args: any[], abiFunc: AbiFunctionDoc) => args, // eslint-disable-line
  getCmdArgs: (abiFunc: AbiFunctionDoc) =>
    abiFunc.inputs.map((input) => {
      const desc = abiFunc._metadata?.params?.[input.name!] || `${input.type} parameter`;
      return new Argument(`<${input.name}>`, desc);
    }),
};
