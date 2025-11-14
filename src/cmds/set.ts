import { Argument, Command, Option } from "commander";
import { Address } from "viem";
import { abi, AbiFunctionDoc } from "../abi.js";
import { Universe } from "../config.js";
import { CommandGenConfig, CommandGenDefaults, getCommandGen, makeFuncName } from "../cmdgen.js";
import { outputOptions, writeOptions } from "../commander-patch.js";
import { FromOpts } from "../from-opts.js";
import { coerceValue, loadJson } from "../utils.js";
import { getAbi, getArtifactPath, getCreationCode } from "../artifact.js";
import { Logger } from "../logger.js";

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

const deployCmd = genDeployCmd();

export const setCmd = new Command("set")
  .description("manage sets")
  .addCommand(deployCmd)
  .addCommands(adminCmds.map(getCommandGen(adminCmdConfig)))
  .addCommands(userCmds.map(getCommandGen(userCmdConfig)));

function genDeployCmd() {
  const cmdArgs = [
    new Argument(`<artifact>`, "Artifact path of the contract"),
    new Argument(`[args...]`, "Constructor arguments"),
  ];
  const cmdOpts = [
    new Option("-o, --out <dir>", "Artifact output directory").default("./out"),
    ...writeOptions,
    ...outputOptions,
  ];

  function getDeployArgs(cmd: Command) {
    const opts = cmd.opts();
    const artifactInfo = getArtifactPath(cmd.args[0], opts.artifactDir);
    const userArgs = cmd.args.slice(1);

    const artifact = loadJson(artifactInfo.file);
    const abi = getAbi(artifact);
    const bytecode = getCreationCode(artifact);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctor = (abi as any[]).find((i) => i.type === "constructor");
    if (!ctor) {
      if (userArgs.length > 0) {
        throw new Error(`No constructor defined, got ${userArgs.length} args`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { abi, bytecode, args: [] as any[] };
    } else if (!ctor.inputs || ctor.inputs.length === 0) {
      if (userArgs.length > 0) {
        throw new Error(`Constructor expects 0 args, got ${userArgs.length}`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { abi, bytecode, args: [] as any[] };
    }

    const expected = ctor.inputs.length;
    if (userArgs.length !== expected) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sig = `(${ctor.inputs.map((p: any) => p.type).join(", ")})`;
      throw new Error(`Constructor expects ${expected} args ${sig}, got ${userArgs.length}`);
    }

    const args = userArgs.map((arg, i) => coerceValue(arg, ctor.inputs[i]));
    return { abi, bytecode, args };
  }

  async function action(this: Command) {
    const opts = this.opts();
    const { args, abi, bytecode } = getDeployArgs(this);
    const { walletClient, publicClient } = await FromOpts.toWriteEthereum(opts);
    const console = new Logger(opts);

    console.log("Transaction sending...");
    const hash = await walletClient.deployContract({
      abi,
      account: walletClient.account!,
      bytecode,
      args,
      chain: undefined,
    });
    console.log(`Transaction sent: ${hash}`);
    console.log("Waiting for confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Confirmed in: block ${receipt.blockNumber}, hash ${receipt.blockHash}`);
    console.log(`Contract deployed at: ${receipt.contractAddress}`);
    const result = {
      transaction: hash,
      block: { number: receipt.blockNumber, hash: receipt.blockHash },
      deployedTo: receipt.contractAddress,
    };
    console.result(result);
  }

  return new Command("deploy")
    .description("Deploy a contract")
    .addOptions(cmdOpts)
    .addArguments(cmdArgs)
    .action(action);
}
