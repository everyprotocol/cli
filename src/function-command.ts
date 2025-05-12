import fs from "fs";
import path from "path";
import os from "os";
import promptSync from "prompt-sync";
import JSON5 from "json5";
import { Command, OptionValues } from "commander";
import { Address, createPublicClient, createWalletClient, encodeAbiParameters, http, parseEventLogs } from "viem";
import { formatAbiParameter } from "abitype";
import { privateKeyToAccount } from "viem/accounts";
import { Wallet } from "ethers";
import { getUniverseConfig } from "./config";
import { AbiFunctionDoc, UniverseConfig } from "./types";

export class FunctionCommand extends Command {
  configure(
    contract: string,
    func: AbiFunctionDoc,
    nonFuncs: AbiFunctionDoc[],
    getName?: (func: AbiFunctionDoc) => string
  ) {
    const name = getName ? getName(func) : func.name;
    const desc = func._metadata?.notice || name;
    const read = func.stateMutability == "view" || func.stateMutability == "pure";
    if (read) {
      return this.name(name)
        .description(desc)
        .functionArguments(func)
        .readFunctionOptions()
        .readFunctionAction(func, nonFuncs, contract);
    } else {
      return this.name(name)
        .description(desc)
        .functionArguments(func)
        .writeFunctionOptions()
        .writeFunctionAction(func, nonFuncs, contract);
    }
  }

  functionArguments(func: AbiFunctionDoc): FunctionCommand {
    func.inputs.forEach((input) => {
      const argDesc = func._metadata?.params?.[input.name!] || `${input.type} parameter`;
      this.argument(`<${input.name}>`, argDesc);
    });
    return this;
  }

  writeFunctionOptions(): FunctionCommand {
    return this.option("-u, --universe <universe>", "universe name", "local")
      .option("-k, --private-key <key>", "private key to sign the transaction")
      .option("-a, --account <account>", "name of the keystore to sign the transaction")
      .option("-p, --password [password]", "password to decrypt the keystore")
      .option("-f, --password-file <file>", "file containing the password to decrypt the keystore")
      .option("--foundry", "use keystore from Foundry directory (~/.foundry/keystores)");
  }

  readFunctionOptions(): FunctionCommand {
    return this.option("-u, --universe <universe>", "universe name", "local");
  }

  readFunctionAction(
    func: AbiFunctionDoc,
    nonFuncs: AbiFunctionDoc[],
    contract: string,
    prepareContract?: (
      conf: UniverseConfig,
      cmd: Command,
      contract: string,
      func: AbiFunctionDoc
    ) => { args: any[]; address: Address }
  ): FunctionCommand {
    return this.action(readContract(func, nonFuncs, contract, prepareContract));
  }

  writeFunctionAction(
    func: AbiFunctionDoc,
    nonFuncs: AbiFunctionDoc[],
    contract: string,
    prepareContract?: (
      conf: UniverseConfig,
      cmd: Command,
      contract: string,
      func: AbiFunctionDoc
    ) => { args: any[]; address: Address }
  ): FunctionCommand {
    return this.action(writeContract(func, nonFuncs, contract, prepareContract));
  }
}

function readContract(
  func: AbiFunctionDoc,
  nonFuncs: AbiFunctionDoc[],
  contract: string,
  prepareContract?: (
    conf: UniverseConfig,
    cmd: Command,
    contract: string,
    func: AbiFunctionDoc
  ) => { args: any[]; address: Address }
): (this: Command) => Promise<void> {
  return async function (this: Command) {
    const opts = this.opts();
    const uniConf: UniverseConfig = getUniverseConfig(opts);
    const publicClient = createPublicClient({ transport: http(uniConf.rpcUrl) });
    const { args, address } = (prepareContract || defaultPrepareContract)(uniConf, this, contract, func);
    // console.log({ address, args, config: uniConf });
    // console.log(`Calling view function on ${func.name}...`);
    const result = await publicClient.readContract({
      address,
      abi: [func, ...nonFuncs],
      functionName: func.name,
      args,
    });
    console.log(`Result:`, result);
  };
}

export function writeContract(
  func: AbiFunctionDoc,
  nonFuncs: AbiFunctionDoc[],
  contract: string,
  prepareContract?: (
    conf: UniverseConfig,
    cmd: Command,
    contract: string,
    func: AbiFunctionDoc
  ) => { args: any[]; address: Address }
): (this: Command) => Promise<void> {
  return async function (this: Command) {
    const opts = this.opts();
    const uniConf: UniverseConfig = getUniverseConfig(opts);
    const { publicClient, walletClient } = await getClients(uniConf, opts);
    const { args, address } = (prepareContract || defaultPrepareContract)(uniConf, this, contract, func);
    // console.log({ address, args, config: uniConf });
    const { request } = await publicClient.simulateContract({
      address,
      abi: [func, ...nonFuncs],
      functionName: func.name,
      args,
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(request);
    console.log(`Transaction sent: ${hash}`);
    console.log("Transaction mining...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("Transaction mined");
    if (receipt.logs && receipt.logs.length > 0) {
      const parsedLogs = parseEventLogs({
        abi: [func, ...nonFuncs],
        logs: receipt.logs,
      });
      parsedLogs.forEach((log: any) => {
        console.log(" - Event", log.eventName, JSON5.stringify(log.args, replacer));
      });
    }
  };
}

const replacer = (_key: string, value: any) => (typeof value === "bigint" ? value.toString() : value);

export function checkArguments(raw: any[], func: AbiFunctionDoc): any[] {
  return raw.map((rawArg, index) => {
    const abiParam = func.inputs[index];
    const pt = abiParam?.type;
    const arg = pt === "address" || pt.startsWith("bytes") || pt === "string" ? rawArg : JSON5.parse(rawArg);
    try {
      encodeAbiParameters([abiParam], [arg]);
    } catch (e: any) {
      throw new Error(`invalid param ${formatAbiParameter(abiParam)}\n${e.message}`);
    }
    return arg;
  });
}

function defaultPrepareContract(
  conf: UniverseConfig,
  cmd: Command,
  contract: string,
  func: AbiFunctionDoc
): { args: any[]; address: Address } {
  const args = checkArguments(cmd.args, func);
  const address = conf.contracts[contract] as Address;
  return { args, address };
}

async function getClients(uniConf: UniverseConfig, opts: OptionValues) {
  const transport = http(uniConf.rpcUrl);
  const publicClient = createPublicClient({ transport });
  const privateKey = await readPrivateKey(opts);
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, transport });
  return { publicClient, walletClient };
}

async function readPrivateKey(opts: OptionValues) {
  if (opts.privateKey) {
    return opts.privateKey.startsWith("0x") ? opts.privateKey : `0x${opts.privateKey}`;
  } else if (opts.account) {
    const keystorePath = path.join(os.homedir(), opts.foundry ? ".foundry" : ".every", "keystores", opts.account);
    const keystore = JSON.parse(fs.readFileSync(keystorePath, "utf8"));
    const password = opts.password
      ? opts.password
      : opts.passwordFile
        ? fs.readFileSync(opts.passwordFile, "utf8").trim()
        : keystore.crypto
          ? promptSync({ sigint: true })("Enter password to decrypt keystore: ", { echo: "" })
          : undefined;
    const wallet = await Wallet.fromEncryptedJson(JSON.stringify(keystore), password);
    return wallet.privateKey;
  } else {
    throw new Error(`--account or --private-key not specified`);
  }
}
