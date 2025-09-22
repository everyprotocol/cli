import { Command } from "commander";
import { abi, AbiFunctionDoc } from "../abi.js";
import { Universe } from "../config.js";
import { CommandGenConfig, getCommandGen, makeFuncName } from "../cmdgen.js";
import { Address } from "viem";

const cmdGenConfig: CommandGenConfig = {
  getFuncName: (cmdName: string) => makeFuncName(cmdName, `kind`),
  getAbiFuncs: (funcName: string) => (abi.funcs.kindRegistry as AbiFunctionDoc[]).filter((i) => i.name == funcName),
  // eslint-disable-next-line
  getAbiNonFuncs: (funcName: string) => abi.nonFuncs.kindRegistry,
  // eslint-disable-next-line
  getContract: (conf: Universe, args: any[], abiFunc: AbiFunctionDoc) => conf.contracts.KindRegistry as Address,
};

const cmdGen = getCommandGen(cmdGenConfig);

const subCmds = "register,upgrade,touch,transfer,owner,descriptor,snapshot".split(",");

export const kindCmd = new Command("kind").description("manage kinds").addCommands(subCmds.map(cmdGen));
