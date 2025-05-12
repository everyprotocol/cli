import { Command } from "commander";
import { Address, parseAbiItem } from "viem";
import { AbiFunctionDoc, UniverseConfig } from "../types";
import { checkArguments, FunctionCommand } from "../function-command";

const func = parseAbiItem("function registerSet(bytes32 data)") as any as AbiFunctionDoc;
const funcRegister = parseAbiItem("function setRegisterFake(address set, bytes32 data)") as any as AbiFunctionDoc;
const funcUpdate = parseAbiItem("function setUpdateFake(address set, bytes32 data)") as any as AbiFunctionDoc;
const funcTouch = parseAbiItem("function setTouchFake(address set, bytes32 data)") as any as AbiFunctionDoc;

const genPrepare = (funcFake: AbiFunctionDoc) =>
  function prepareContract(conf: UniverseConfig, cmd: Command, contract: string, func: AbiFunctionDoc) {
    let args = checkArguments(cmd.args, funcFake);
    const address = args[0] as Address;
    args = args.slice(1);
    return { args, address };
  };

export const setRegisterCmd = new FunctionCommand()
  .name("register")
  .description("")
  .argument("<code>", "description")
  .argument("<data>", "description")
  .writeFunctionOptions()
  .writeFunctionAction(func, [], "ISetContract", genPrepare(funcRegister));

export const setUpdateCmd = new FunctionCommand()
  .name("update")
  .description("")
  .argument("<code>", "description")
  .argument("<data>", "description")
  .writeFunctionOptions()
  .writeFunctionAction(func, [], "ISetContract", genPrepare(funcUpdate));

export const setTouchCmd = new FunctionCommand()
  .name("touch")
  .description("")
  .argument("<code>", "description")
  .writeFunctionOptions()
  .writeFunctionAction(func, [], "ISetContract", genPrepare(funcTouch));
