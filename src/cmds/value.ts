import { Command } from "commander";
import { abi, AbiFunctionDoc } from "../abi.js";
import { Universe } from "../config.js";
import { CommandGenConfig, getCommandGen, makeFuncName } from "../cmdgen.js";
import { Address } from "viem";

const cmdGenConfig: CommandGenConfig = {
  getFuncName: (cmdName: string) => makeFuncName(cmdName, `value`),
  getAbiFuncs: (funcName: string) => (abi.funcs.elemRegistry as AbiFunctionDoc[]).filter((i) => i.name == funcName),
  // eslint-disable-next-line
  getAbiNonFuncs: (funcName: string) => abi.nonFuncs.elemRegistry,
  // eslint-disable-next-line
  getContract: (conf: Universe, args: any[], abiFunc: AbiFunctionDoc) => conf.contracts.ElementRegistry as Address,
};

const cmdGen = getCommandGen(cmdGenConfig);

const subCmds = "register,upgrade,touch,transfer,owner,descriptor,snapshot".split(",");

export const valueCmd = new Command("value").description("manage values").addCommands(subCmds.map(cmdGen));
