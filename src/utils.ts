import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as JSON11 from "json11";
import { isHex, hexToU8a } from "@polkadot/util";
import { base64Decode } from "@polkadot/util-crypto/base64";
import { decodePair } from "@polkadot/keyring/pair/decode";
import { AbiParameter, getAddress, isAddress } from "viem";
import { ApiPromise } from "@polkadot/api";
import { Command } from "commander";
import { FromOpts } from "./from-opts.js";

export const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function version() {
  const pkgPath = path.resolve(__dirname, "../package.json");
  return JSON.parse(fs.readFileSync(pkgPath, "utf-8")).version;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadJson(file: string): any {
  if (!fs.existsSync(file)) {
    throw new Error(`Keystore file not found: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// eslint-disable-next-line
export function saveJson(json: any, dir: string, name: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const file = path.join(dir, name);
  if (fs.existsSync(file)) {
    throw new Error(`File exists: ${file}`);
  }
  fs.writeFileSync(file, JSON.stringify(json));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decodePairFromJson(keystore: any, password?: string) {
  const encodedRaw = keystore.encoded;
  let encodingType = keystore.encoding.type;
  encodingType = !Array.isArray(encodingType) ? [encodingType] : encodingType;
  const encoded = isHex(encodedRaw) ? hexToU8a(encodedRaw) : base64Decode(encodedRaw);
  const decoded = decodePair(password, encoded, encodingType);
  return decoded;
}

export function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".txt":
      return "text/plain";
    case ".json":
      return "application/json";
    case ".wasm":
      return "application/wasm";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

export function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: object) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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

export function coerceValue(val: string, param: AbiParameter): unknown {
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

export async function substrateAction<T>(
  cmd: Command,
  api: ApiPromise,
  fn: (api: ApiPromise) => Promise<T>
): Promise<T | undefined> {
  try {
    return await fn(api);
  } catch (e: any /* eslint-disable-line */) {
    cmd.error(e.message);
  } finally {
    api.disconnect().catch(() => {});
  }
}

// eslint-disable-next-line
type SubAction = (this: Command, api: ApiPromise, ...args: any[]) => void | Promise<void>;

export function wrapSubAction(fn: SubAction) {
  // eslint-disable-next-line
  return async function (this: Command, ...args: any[]) {
    const api = await FromOpts.getSubstrateApi(this.opts());
    try {
      // keep Commander’s `this` binding and pass api first
      return await fn.call(this, api, ...args);
    } finally {
      await api.disconnect().catch(() => {});
    }
  };
}

export function loadBinary(file: string): Uint8Array {
  const buf = fs.readFileSync(file);
  return buf;
}

export function readKindElements(file: string): number[] {
  const buf = fs.readFileSync(file);
  const mod = new WebAssembly.Module(buf); // sync
  const [section] = WebAssembly.Module.customSections(mod, "kindelms");
  if (!section) throw new Error(`Section "kindelms" not found in ${file}`);
  return Array.from(new Uint8Array(section));
}

export function toElementType(v: string | number): number {
  const n = typeof v === "number" ? v : v.startsWith("0x") ? Number.parseInt(v.slice(2), 16) : Number.parseInt(v, 10);

  if (!Number.isInteger(n) || n < 1 || n > 255) {
    throw new Error(`Invalid element type: ${v} (must be 1–255)`);
  }
  return n;
}

export function toRelationId(v: string | bigint): bigint {
  const n = typeof v === "bigint" ? v : BigInt(v);
  const U48_MAX = (1n << 48n) - 1n;
  if (n < 1n || n > U48_MAX) {
    throw new Error(`Invalid relation id: ${String(v)} (must be between 1 and ${U48_MAX})`);
  }
  return n;
}

export function stringify(v: unknown, options?: unknown): string {
  return JSON11.stringify(v, options ?? { quoteNames: true, quote: '"', withBigInt: false });
}

export function j11String(v: unknown, options?: unknown): string {
  return JSON11.stringify(v, options);
}

export function j11Parse(str: string): unknown {
  return JSON11.parse(str);
}
