import { Command } from "commander";
import { abi, AbiFunctionDoc } from "../abi.js";
import { Universe } from "../config.js";
import { CommandGenConfig, getCommandGen, makeFuncName } from "../cmdgen.js";
import { Address } from "viem";

const cmdGenConfig: CommandGenConfig = {
  getFuncName: (cmdName: string) => makeFuncName(cmdName, `relation`),
  getAbiFuncs: (funcName: string) => (abi.funcs.omniRegistry as AbiFunctionDoc[]).filter((i) => i.name == funcName),
  // eslint-disable-next-line
  getAbiNonFuncs: (funcName: string) => abi.nonFuncs.omniRegistry,
  // eslint-disable-next-line
  getContract: (conf: Universe, args: any[], abiFunc: AbiFunctionDoc) => conf.contracts.OmniRegistry as Address,
  // eslint-disable-next-line
  getFuncArgs: (args: any[], abiFunc: AbiFunctionDoc) => args,
};

const cmdGen = getCommandGen(cmdGenConfig);

const subCmds = "register,upgrade,touch,transfer,owner,descriptor,snapshot,rule,admit".split(",");

export const relationCmd = new Command("relation").description("manage relations").addCommands(subCmds.map(cmdGen));
