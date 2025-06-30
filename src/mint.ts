import { Command } from "commander";
import { defaultWriteFunctionOptions } from "./cmds.js";
import { getClientsEth, stringify } from "./utils.js";
import { getUniverseConfig } from "./config.js";
import { Address, parseEventLogs, parseUnits } from "viem";
import { abi } from "./abi.js";

export function genMintCommand() {
  const cmd = new Command()
    .name("mint")
    .description("Mint an object via ObjectMinter")
    .option("--auth <data>", "authorization data, if needed for a permissioned mint", "0x")
    .option("--policy <index>", "the index number of the mint policy", "0")
    .option("--value <amount>", "the amount of ETH to send together", "0")
    .argument("<sid>", "scoped object ID, in form of set.id (e.g., 17.1)")
    .argument("<to>", "address of the recipient")
    .argument("[data]", "additional mint data", "0x")
    .action(action);
  defaultWriteFunctionOptions().forEach((option) => cmd.addOption(option));
  return cmd;
}

async function action(this: Command) {
  const opts = this.opts();
  const args0 = this.args;
  const conf = getUniverseConfig(opts);
  const objectMinter = conf.contracts["ObjectMinter"] as Address;
  const setRegistry = conf.contracts["SetRegistry"] as Address;
  const { publicClient, walletClient } = await getClientsEth(conf, opts);
  const account = walletClient.account;
  const [set, id] = args0[0].split(".");
  const setContract = (await publicClient.readContract({
    address: setRegistry,
    abi: abi.setContract,
    functionName: "setContract",
    args: [BigInt(set)],
  })) as Address;
  const value = parseUnits(opts.value || "0", 18);
  const { request } = await publicClient.simulateContract({
    address: objectMinter,
    abi: abi.mint,
    functionName: "mint",
    args: [
      args0[1] as Address,
      setContract,
      BigInt(id),
      (args0[2] || "0x") as `0x{string}`,
      opts.auth || "0x",
      Number(opts.policy || "0"),
    ],
    account,
    value,
  });
  const hash = await walletClient.writeContract(request);
  console.log(`Transaction sent: ${hash}`);
  console.log("Transaction mining...");
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Transaction mined");

  if (receipt.logs && receipt.logs.length > 0) {
    const parsedLogs = parseEventLogs({ abi: abi.mint, logs: receipt.logs });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parsedLogs.forEach((log: any) => {
      console.log(" - Event", log.eventName, stringify(log.args));
    });
  }
}
