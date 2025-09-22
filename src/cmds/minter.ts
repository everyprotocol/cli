import { Argument, Command } from "commander";
import { abi, AbiFunctionDoc } from "../abi.js";
import { Universe } from "../config.js";
import { CommandGenConfig, CommandGenDefaults, getCommandGen, makeFuncName } from "../cmdgen.js";
import { Address } from "viem";

const adminCmdConfig: CommandGenConfig = {
  getFuncName: (cmdName: string) => `${cmdName}MintPolicy`,
  getAbiFuncs: (funcName: string) =>
    (abi.funcs.objectMinterAdmin as AbiFunctionDoc[]).filter((i) => i.name == funcName),
  // eslint-disable-next-line
  getAbiNonFuncs: (funcName: string) => abi.nonFuncs.objectMinter,
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
  getFuncName: (cmdName: string) => makeFuncName(cmdName, `mintPolicy`),
  getAbiFuncs: (funcName: string) => (abi.funcs.objectMinter as AbiFunctionDoc[]).filter((i) => i.name == funcName),
  // eslint-disable-next-line
  getAbiNonFuncs: (funcName: string) => abi.nonFuncs.objectMinter,
  // eslint-disable-next-line
  getContract: (conf: Universe, args: any[], abiFunc: AbiFunctionDoc) => conf.contracts.ObjectMinter as Address,
};

const adminCmds = "add,enable,disable".split(",");

const userCmds = "count,get,search".split(",");

export const minterCmd = new Command("minter")
  .description("manage mint policies")
  .addCommands(adminCmds.map(getCommandGen(adminCmdConfig)))
  .addCommands(userCmds.map(getCommandGen(userCmdConfig)));
