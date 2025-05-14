import { createPublicClient, createWalletClient, encodeAbiParameters, http, PublicClient, WalletClient } from "viem";
import { formatAbiParameter } from "abitype";
import { UniverseConfig } from "./config.js";
import fs from "fs";
import path from "path";
import { OptionValues } from "commander";
import { Wallet } from "ethers";
import { privateKeyToAccount } from "viem/accounts";
import promptSync from "prompt-sync";
import os from "os";
import JSON5 from "json5";
import { AbiFunctionDoc } from "./abi.js";
import { fileURLToPath } from "url";

export const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function version() {
  const pkgPath = path.resolve(__dirname, "../package.json");
  return JSON.parse(fs.readFileSync(pkgPath, "utf-8")).version;
}

export function lstrip(prefix: string) {
  return function (func: AbiFunctionDoc): string {
    return func.name.startsWith(prefix) ? func.name.substring(prefix.length).toLowerCase() : func.name;
  };
}

export function rstrip(postfix: string) {
  return function (func: AbiFunctionDoc): string {
    return func.name.endsWith(postfix) ? func.name.slice(0, -postfix.length) : func.name;
  };
}

export function startsWith(prefix: string) {
  return function (func: AbiFunctionDoc): boolean {
    return func.name.startsWith(prefix);
  };
}

export function excludes(names: string[]) {
  return function (func: AbiFunctionDoc): boolean {
    return !names.includes(func.name);
  };
}

export function includes(names: string[]) {
  return function (f: AbiFunctionDoc): boolean {
    return names.includes(f.name);
  };
}

export function stringify(o: unknown) {
  const replacer = (_key: string, value: unknown) => (typeof value === "bigint" ? value.toString() : value);
  return JSON5.stringify(o, replacer);
}

export async function getClients(
  uniConf: UniverseConfig,
  opts: OptionValues
): Promise<{ publicClient: PublicClient; walletClient: WalletClient }> {
  const transport = http(uniConf.rpcUrl);
  const publicClient: PublicClient = createPublicClient({ transport });
  const privateKey = await readPrivateKey(opts);
  const account = privateKeyToAccount(privateKey);
  const walletClient: WalletClient = createWalletClient({ account, transport });
  return { publicClient, walletClient };
}

export async function readPrivateKey(opts: OptionValues) {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkArguments(raw: unknown[], func: AbiFunctionDoc): any[] {
  return raw.map((rawArg, index) => {
    const abiParam = func.inputs[index];
    const pt = abiParam?.type;
    const arg = pt === "address" || pt.startsWith("bytes") || pt === "string" ? rawArg : JSON5.parse(rawArg as string);
    try {
      encodeAbiParameters([abiParam], [arg]);
    } catch (e: unknown) {
      if (e instanceof Error) {
        throw new Error(`invalid param ${formatAbiParameter(abiParam)}\n${e.message}`);
      }
    }
    return arg;
  });
}
