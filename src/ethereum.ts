import { parseEventLogs, PublicClient, WalletClient, SimulateContractParameters, WriteContractParameters } from "viem";
import columnify from "columnify";
import { stringify as j11 } from "json11";
import { Logger } from "./logger.js";

export async function submitSimulation(
  simulation: SimulateContractParameters,
  publicClient: PublicClient,
  walletClient: WalletClient,
  console: Logger
) {
  console.log("Transaction sending...");
  const { request } = await publicClient.simulateContract(simulation);
  const hash = await walletClient.writeContract(request as WriteContractParameters);
  console.log(`Transaction sent: ${hash}`);
  console.log("Waiting for confirmation...");
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in: block ${receipt.blockNumber}, hash ${receipt.blockHash}`);

  const output: [number, string, string][] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events: { name: string; data: any }[] = [];
  if (receipt.logs && receipt.logs.length > 0) {
    const parsedLogs = parseEventLogs({ abi: simulation.abi, logs: receipt.logs });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parsedLogs.forEach((log: any, i: number) => {
      output.push([i, log.eventName, j11(log.args)]);
      events.push({ name: log.eventName, data: log.args });
    });
  }
  if (output.length > 0) {
    console.log("Events emitted");
    const termWidth = process.stdout.columns || 80;
    const config = {
      2: { maxWidth: Math.max(60, termWidth - 20) },
    };
    console.log(columnify(output, { showHeaders: false, truncateMarker: "", config }));
  }
  const result = { transaction: hash, block: { number: receipt.blockNumber, hash: receipt.blockHash }, events };
  console.result(result);
}
