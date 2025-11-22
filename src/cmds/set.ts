import { Argument, Command, Option } from "commander";
import { Address, PublicClient } from "viem";
import { Universe } from "../config.js";
import { outputOptions, writeOptions } from "../commander-patch.js";
import { FromOpts } from "../from-opts.js";
import { coerceValue, loadJson } from "../utils.js";
import { getAbiFromArtifact, getArtifactPath, getCreationCode } from "../artifact.js";
import { Logger } from "../logger.js";
import { AbiCommandConfig, genAbiCommand } from "../abicmd.js";
import { getFuncs, getAbi, AbiFunctionDoc } from "../abi2.js";
import { parseAddress } from "../parsers.js";
import { makeFuncName } from "../cmdgen.js";

const abiFuncs = getFuncs("ISetRegistry") as AbiFunctionDoc[];
const abiFuncsAdmin = getFuncs("SetRegistryAdmin") as AbiFunctionDoc[];

async function getAbc(
  conf: Universe,
  client: PublicClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[],
  id: bigint,
  altFuncName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<[Address, any[], AbiFunctionDoc | undefined]> {
  if (id >= 17) {
    const addr = await getSetContract(id, client, conf);
    return [addr, args, undefined];
  } else {
    const abiFunc = abiFuncs.filter((i) => i.name == altFuncName)[0];
    return [conf.contracts.SetRegistry as Address, args, abiFunc];
  }
}

const cmdConfig: AbiCommandConfig = {
  descs: {
    upgradeSet: "Upgrade an existing set",
  },
  params: {
    ".rev0": () => new Option(`--rev <rev0>`).default(0),
    ".krev0": () => new Option(`--krev <rev0>`).default(0),
    ".krev": () => new Option(`--krev <rev0>`).default(0),
    ".srev0": () => new Option(`--srev <rev0>`).default(0),
    ".srev": () => new Option(`--srev <rev0>`).default(0),
    ".kindRev": () => new Option(`--krev <rev0>`).default(0),
    ".setRev": () => new Option(`--srev <rev0>`).default(0),
    ".kindRev0": () => new Option(`--krev <rev0>`, "New kind revision").default(0),
    ".setRev0": () => new Option(`--srev <rev0>`, "New set revision").default(0),
    "registerSet.PREPEND": () => new Argument(`<contract>`, "Contract address").argParser(parseAddress),
  },
  // eslint-disable-next-line
  prepare: async (conf: Universe, client: PublicClient, args: any[], funcName?: string) => {
    if (funcName == "registerSet") {
      return [args[0] as Address, args.slice(1), undefined];
    } else if (funcName == "updateSet") {
      return await getAbc(conf, client, args, args[0], "setUpdate");
    } else if (funcName == "upgradeSet") {
      return await getAbc(conf, client, args, args[0], "setUpgrade");
    } else if (funcName == "touchSet") {
      return await getAbc(conf, client, args, args[0], "setTouch");
    } else {
      return [conf.contracts.SetRegistry as Address, args, undefined];
    }
  },
};

const adminCmds = "register,update,upgrade,touch".split(",").map((name) => {
  const funcName = `${name}Set`;
  const abiFunc = abiFuncsAdmin.filter((i) => i.name == funcName)[0];
  return genAbiCommand(name, abiFunc, cmdConfig);
});

const readCmds = "owner,descriptor,snapshot".split(",").map((name) => {
  const funcName = makeFuncName(name, "set");
  const abiFunc = abiFuncs.filter((i) => i.name == funcName)[0];
  return genAbiCommand(name, abiFunc, cmdConfig);
});

const deployCmd = genDeployCmd();

export const setCmd = new Command("set")
  .description("manage sets")
  .addCommand(deployCmd)
  // .addCommands(adminCmds.map(getCommandGen(adminCmdConfig)))
  .addCommands(adminCmds)
  .addCommands(readCmds);

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
    const abi = getAbiFromArtifact(artifact);
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
    .description("Deploy a set contract")
    .addOptions(cmdOpts)
    .addArguments(cmdArgs)
    .action(action);
}

async function getSetContract(set: bigint, publicClient: PublicClient, conf: Universe) {
  const abi = getAbi("ISetRegistry");
  const address = await publicClient.readContract({
    address: conf.contracts.SetRegistry as Address,
    abi,
    functionName: "setContract",
    args: [set],
  });
  return address as unknown as Address;
}
