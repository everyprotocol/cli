import { Argument, Command } from "commander";
import { abi, AbiFunctionDoc } from "../abi.js";
import { Universe } from "../config.js";
import { CommandGenConfig, CommandGenDefaults, getCommandGen, makeFuncName } from "../cmdgen.js";
import { Address } from "viem";

const adminCmdConfig: CommandGenConfig = {
  getFuncName: (cmdName: string) => `${cmdName}Set`,
  getAbiFuncs: (funcName: string) => (abi.funcs.setRegistryAdmin as AbiFunctionDoc[]).filter((i) => i.name == funcName),
  // eslint-disable-next-line
  getAbiNonFuncs: (funcName: string) => abi.nonFuncs.setRegistry,
  // eslint-disable-next-line
  getContract: (conf: Universe, args: any[], abiFunc: AbiFunctionDoc) => args[0] as Address,
  // eslint-disable-next-line
  getFuncArgs: (args: any[], abiFunc: AbiFunctionDoc) => args.slice(1),

  getCmdArgs: (abiFunc: AbiFunctionDoc) => [
    new Argument(`<contract>`, "address of the set contract"),
    ...CommandGenDefaults.getCmdArgs(abiFunc),
  ],
};

const userCmdConfig: CommandGenConfig = {
  getFuncName: (cmdName: string) => makeFuncName(cmdName, `set`),
  getAbiFuncs: (funcName: string) => (abi.funcs.setRegistry as AbiFunctionDoc[]).filter((i) => i.name == funcName),
  // eslint-disable-next-line
  getAbiNonFuncs: (funcName: string) => abi.nonFuncs.setRegistry,
  // eslint-disable-next-line
  getContract: (conf: Universe, args: any[], abiFunc: AbiFunctionDoc) => conf.contracts.SetRegistry as Address,
};

const userCmds = "owner,descriptor,snapshot".split(",");

const adminCmds = "register,update,upgrade,touch".split(",");

export const setCmd = new Command("set")
  .description("manage sets")
  .addCommands(adminCmds.map(getCommandGen(adminCmdConfig)))
  .addCommands(userCmds.map(getCommandGen(userCmdConfig)));
