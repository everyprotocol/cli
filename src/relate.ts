import { Command, OptionValues } from "commander";
import { defaultWriteFunctionOptions } from "./cmds.js";
import { getClients, stringify } from "./utils.js";
import { getUniverseConfig, UniverseConfig } from "./config.js";
import { Address, parseEventLogs } from "viem";
import { abi } from "./abi.js";

export function genRelateCommand() {
  const cmd = new Command()
    .name("relate")
    .description("Link a tail object to a head object through a relation")
    .argument("<tail>", "tail node, in form of [[data.]grant.]set.id")
    .argument("<rel>", "relation ID")
    .argument("<head>", "head node in form of [grant.]set.id, ")
    .action(async function () {
      await action(this, "relate");
    });
  defaultWriteFunctionOptions().forEach((option) => cmd.addOption(option));
  return cmd;
}

export function genUnrelateCommand() {
  const cmd = new Command()
    .name("unrelate")
    .description("Unlinks a tail object from a head object")
    .argument("<tail>", "tail node, in form of [[data.]grant.]set.id")
    .argument("<rel>", "relation ID")
    .argument("<head>", "head node in form of [grant.]set.id, ")
    .action(async function () {
      await action(this, "unrelate");
    });
  defaultWriteFunctionOptions().forEach((option) => cmd.addOption(option));
  return cmd;
}

async function action(cmd: Command, functionName: string) {
  const opts = cmd.opts();
  const args0 = cmd.args;
  const conf = getUniverseConfig(opts);

  const address = conf.contracts["OmniRegistry"] as Address;
  const tail = parseNode4(args0[0]);
  const rel = BigInt(args0[1]);
  const head = parseNode3(args0[2]);

  await sendTransaction(conf, opts, address, abi.relation, functionName, [tail, rel, head]);
}

async function sendTransaction(
  conf: UniverseConfig,
  opts: OptionValues,
  address: `0x${string}`,
  abi: any /* eslint-disable-line @typescript-eslint/no-explicit-any*/,
  functionName: string,
  args: any[] /* eslint-disable-line @typescript-eslint/no-explicit-any*/
) {
  const { publicClient, walletClient } = await getClients(conf, opts);
  const { request } = await publicClient.simulateContract({
    address,
    abi,
    functionName: "relate",
    args,
    account: walletClient.account,
  });
  const hash = await walletClient.writeContract(request);
  console.log(`Transaction sent: ${hash}`);
  console.log("Transaction mining...");
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Transaction mined");

  if (receipt.logs && receipt.logs.length > 0) {
    const parsedLogs = parseEventLogs({ abi: abi.relation, logs: receipt.logs });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parsedLogs.forEach((log: any) => {
      console.log(" - Event", log.eventName, stringify(log.args));
    });
  }
}

function parseNode4(arg: string): bigint {
  const parts = arg.split(".");
  let [data, grant, set, id] = [0n, 0n, 0n, 0n];
  if (parts.length == 2) {
    set = BigInt(parts[0]);
    id = BigInt(parts[1]);
  } else if (parts.length == 3) {
    grant = BigInt(parts[0]);
    set = BigInt(parts[1]);
    id = BigInt(parts[2]);
  } else if (parts.length == 4) {
    data = BigInt(parts[0]);
    grant = BigInt(parts[1]);
    set = BigInt(parts[2]);
    id = BigInt(parts[3]);
  } else {
    throw new Error("");
  }
  return (data << 192n) | (grant << 128n) | (set << 64n) | id;
}

function parseNode3(arg: string): bigint {
  const parts = arg.split(".");
  let [grant, set, id] = [0n, 0n, 0n];
  if (parts.length == 2) {
    set = BigInt(parts[0]);
    id = BigInt(parts[1]);
  } else if (parts.length == 3) {
    grant = BigInt(parts[0]);
    set = BigInt(parts[1]);
    id = BigInt(parts[2]);
  } else {
    throw new Error("");
  }
  return (grant << 128n) | (set << 64n) | id;
}
