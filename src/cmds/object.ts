import { Command, OptionValues } from "commander";
import {
  parseAbiItem,
  isAddress,
  getAddress,
  type AbiFunction,
  type AbiParameter,
  Address,
  parseUnits,
  parseEventLogs,
  erc1155Abi,
  erc721Abi,
} from "viem";
import columnify from "columnify";
import * as JSON11 from "json11";
import { getClientsEth, getUniverseConfig } from "../utils.js";
import { abi } from "../abi.js";

const isArrayType = (t: string) => /\[[^\]]*\]$/.test(t);
const isTupleType = (t: string) => t.startsWith("tuple");
const elemType = (t: string) => t.replace(/\[[^\]]*\]$/, "");
// const fmtInputs = (ins: ReadonlyArray<Pick<AbiParameter, "name" | "type">>) =>
//   ins.map((i) => (i.name ? `${i.type} ${i.name}` : i.type)).join(", ");

function hasComponents(p: AbiParameter): p is AbiParameter & { components: ReadonlyArray<AbiParameter> } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (p as any).components !== "undefined";
}

function coerceScalar(val: string, type: string): string | boolean | bigint {
  const base = elemType(type);
  if (base === "address") {
    if (!isAddress(val)) throw new Error(`Invalid address: ${val}`);
    return getAddress(val);
  }
  if (base === "bool") {
    if (!/^(true|false)$/i.test(val)) throw new Error(`Invalid bool: ${val}`);
    return /^true$/i.test(val);
  }
  if (base === "string") return val;
  if (base.startsWith("bytes")) {
    if (!/^0x[0-9a-fA-F]*$/.test(val)) throw new Error(`Invalid ${base} (expect 0x...)`);
    return val;
  }
  if (base.startsWith("uint") || base.startsWith("int")) {
    try {
      return val.startsWith("0x") ? BigInt(val) : BigInt(val);
    } catch {
      throw new Error(`Invalid ${base}: ${val}`);
    }
  }
  return val;
}

function coerceValue(val: string, param: AbiParameter): unknown {
  const { type } = param;

  // arrays: expect JSON array; recurse on element type (preserve components if tuple[])
  if (isArrayType(type)) {
    const arr = JSON.parse(val);
    if (!Array.isArray(arr)) throw new Error(`Expected array for ${type}`);

    // build element param (carry tuple components if present)
    const inner: AbiParameter = hasComponents(param)
      ? ({ ...param, type: elemType(type), components: param.components } as AbiParameter)
      : ({ ...param, type: elemType(type) } as AbiParameter);

    return arr.map((v) => coerceValue(typeof v === "string" ? v : JSON.stringify(v), inner));
  }

  // tuples: need components
  if (isTupleType(type)) {
    if (!hasComponents(param) || param.components.length === 0) {
      throw new Error(`Tuple components missing for ${type}`);
    }
    const tup = JSON.parse(val);

    if (Array.isArray(tup)) {
      if (tup.length !== param.components.length) {
        throw new Error(`Tuple length mismatch: expected ${param.components.length}, got ${tup.length}`);
      }
      return param.components.map((c, i) =>
        coerceValue(typeof tup[i] === "string" ? tup[i] : JSON.stringify(tup[i]), c)
      );
    }
    // object by names
    return param.components.map((c) => {
      const v = tup[c.name as keyof typeof tup];
      if (v === undefined) throw new Error(`Tuple field missing: ${c.name}`);
      return coerceValue(typeof v === "string" ? v : JSON.stringify(v), c);
    });
  }

  // scalar
  return coerceScalar(val, type);
}

export const objectSendCmd = new Command("send")
  .description("Call a function by signature (dry-run: prints calldata)")
  .option("--sig <sig>", "Function signature, e.g. 'transfer(address,uint256)'")
  .argument("<args...>", "Function arguments (arrays/tuples as JSON)")
  .writeContractOptions()
  .action(async function (this: Command, args: string[]) {
    const { sig } = this.opts<{ sig?: string }>();
    if (!sig) {
      console.error("Error: --sig is required (e.g. --sig 'transfer(address,uint256)')");
      this.exitOverride();
      return;
    }
    await sendTransaction(this.opts(), sig, args);
  });

async function sendTransaction(opts: OptionValues, sig: string, args0: string[]) {
  const item = parseAbiItem(`function ${sig}`);
  if (item.type !== "function") throw new Error(`Not a function signature: ${sig}`);
  const abiFunc: AbiFunction = item as AbiFunction;
  const params = abiFunc.inputs ?? [];
  if (args0.length !== params.length)
    throw new Error(`Argument count mismatch: expected ${params.length}, got ${args0.length}`);
  const sidIndex = params.findIndex((p: AbiParameter) => p.type == "uint64");
  if (sidIndex == -1) throw new Error("SID type(uint64) not found in signature");
  const [setId, objectId] = args0[sidIndex].split(".");
  args0[sidIndex] = objectId;
  const args = args0.map((a, i) => coerceValue(a, params[i]));

  const conf = getUniverseConfig(opts);
  const setRegistry = conf.contracts["SetRegistry"] as Address;
  const { publicClient, walletClient } = await getClientsEth(conf, opts);
  const account = walletClient.account;
  const setContract = (await publicClient.readContract({
    address: setRegistry,
    abi: abi.funcs.setRegistry,
    functionName: "setContract",
    args: [BigInt(setId)],
  })) as Address;
  const value = parseUnits(opts.value ?? "0", 18);

  console.log(`Transaction sending...`);
  const { request } = await publicClient.simulateContract({
    address: setContract,
    abi: [abiFunc],
    functionName: abiFunc.name,
    args: args,
    account,
    value,
  });
  const hash = await walletClient.writeContract(request);
  console.log(`Transaction sent: ${hash}`);
  console.log("Waiting for confirmation...");
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in: block ${receipt.blockNumber}, hash ${receipt.blockHash}`);

  const output: [number, string, string][] = [];
  if (receipt.logs && receipt.logs.length > 0) {
    const parsedLogs = parseEventLogs({
      abi: [...abi.nonFuncs.setContract, ...erc1155Abi, ...erc721Abi],
      logs: receipt.logs,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parsedLogs.forEach((log: any, i: number) => {
      output.push([i, log.eventName, JSON11.stringify(log.args)]);
    });
  }
  if (output.length > 0) {
    const termWidth = process.stdout.columns || 80;
    console.log("Events emitted");
    console.log(
      columnify(output, {
        showHeaders: false,
        truncateMarker: "",
        config: {
          2: {
            maxWidth: Math.max(60, termWidth - 20),
          },
        },
      })
    );
  }
}
