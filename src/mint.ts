import { Command } from "commander";
import { defaultWriteFunctionOptions } from "./cmds.js";
import { getClientsEth, stringify } from "./utils.js";
import { getUniverseConfig } from "./config.js";
import { Address, parseEventLogs, parseUnits } from "viem";
import { abi } from "./abi.js";

export function genMintCommand() {
  const cmd = new Command()
    .name("mint")
    .description("Mint an object via ObjectMinter or directly from set")
    .option("--no-minter", "mint directly from set contract instead of using ObjectMinter")
    .option("--auth <data>", "authorization data, if needed for a permissioned mint", "0x")
    .option("--policy <index>", "the index number of the mint policy", "0")
    .option("--value <amount>", "the amount of ETH to send together", "0")
    .option("--to <address>", "address of the recipient (defaults to sender address)")
    .argument("<sid>", "scoped object ID, in form of set.id (e.g., 17.1)")
    .argument("[data]", "additional mint data", "0x")
    .action(action);
  defaultWriteFunctionOptions().forEach((option) => cmd.addOption(option));
  return cmd;
}

async function action(this: Command) {
  const opts = this.opts();
  const args0 = this.args;
  const conf = getUniverseConfig(opts);
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
  
  // Use the provided recipient address or default to the sender's address
  const recipientAddress = (opts.to || account.address) as Address;
  const mintData = (args0[1] || "0x") as `0x${string}`;

  let hash;
  if (opts.minter) {
    // Mint via ObjectMinter
    const objectMinter = conf.contracts["ObjectMinter"] as Address;
    const { request } = await publicClient.simulateContract({
      address: objectMinter,
      abi: abi.mint,
      functionName: "mint",
      args: [
        recipientAddress,
        setContract,
        BigInt(id),
        mintData,
        opts.auth || "0x",
        Number(opts.policy || "0"),
      ],
      account,
      value,
    });
    hash = await walletClient.writeContract(request);
  } else {
    // Mint directly from set contract
    const { request } = await publicClient.simulateContract({
      address: setContract,
      abi: abi.create,
      functionName: "create",
      args: [recipientAddress, BigInt(id), mintData],
      account,
      value,
    });
    hash = await walletClient.writeContract(request);
  }

  // const hash = await walletClient.writeContract(request);
  console.log(`Transaction sent: ${hash}`);
  console.log("Transaction mining...");
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Transaction mined");

  if (receipt.logs && receipt.logs.length > 0) {
    const abiToUse = opts.minter ? abi.mint : abi.create;
    const parsedLogs = parseEventLogs({ abi: abiToUse, logs: receipt.logs });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parsedLogs.forEach((log: any) => {
      console.log(" - Event", log.eventName, stringify(log.args));
    });
  }
}
