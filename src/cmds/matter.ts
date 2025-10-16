import { Command } from "commander";
import "@polkadot/api-augment/substrate";
import * as fs from "fs";
import * as JSON11 from "json11";
import columify from "columnify";
import { loadBinary, loadJson } from "../utils.js";
import { submitTransaction } from "../substrate.js";
import { network } from "../commander-patch.js";
import { Logger } from "../logger.js";
import path from "path";
import csv from "csv-parser";
import { fromHex, pad, sha256 } from "viem";
import { memoize } from "lodash-es";

const matterRegisterCmd = new Command("register")
  .description("Register matters")
  .argument("<files...>", "Paths of matter blob files")
  .addOption(network)
  .addKeystoreOptions()
  .addOutputOptions()
  .subWriteAction(async function (api, pair, files) {
    const opts = this.opts();
    const console = new Logger(opts);
    const deduper = new Set<string>();
    const inputs: RegisterInput[] = [];
    for (const file of files) {
      const spec = parseFileSpec(file);
      const mi = await toRegisterInput(spec);
      mi.forEach((input) => {
        if (!deduper.has(input.path)) {
          inputs.push(input);
          deduper.add(input.path);
        }
      });
    }

    const txns = [];
    for (const { blob, form, mime, path: filePath } of inputs) {
      const content = blob || fs.readFileSync(filePath);
      console.log(`Register matter: form=${form} mime=${mime} blob=${content.length}B ${filePath}`);
      const contentRaw = api.createType("Raw", content, content.length);
      const call = api.tx.every.matterRegister(form, mime, contentRaw);
      console.log(`Transaction submitting...`);
      const txn = await submitTransaction(api, call, pair);
      console.log(`Transaction submitted: ${txn.txHash}`);
      txns.push({ txn, filePath });
    }

    console.log("Waiting for confirmation...");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] = [];
    for (const { txn, filePath } of txns) {
      const r = await txn.receipt;
      const header = await api.rpc.chain.getHeader(r.blockHash);
      console.log(`Transaction confirmed: ${txn.txHash} ${filePath}`);
      console.log(`Confirmed in: block ${header.number}, hash ${header.hash}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events = r.events.map((e: any) => [e.event.method, JSON11.stringify(e.event.data.toJSON())]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const receipt = r.events.map((e: any) => ({ event: e.event.method, data: e.event.data.toJSON() }));
      console.log(columify(events, { showHeaders: false }));
      result.push({
        file: filePath,
        transaction: txn.txHash,
        events: receipt,
      });
    }
    console.result(result);
  });

const matterCompileCmd = new Command("compile")
  .description("Compile matters from human-readable to binary")
  .argument("<files...>", "Paths to matter files")
  .option("-o, --out <dir>", "Output directory")
  .addOutputOptions()
  .action(async function (files: string[]) {
    const opts = this.opts();
    const console = new Logger(opts);
    const specs = files.map((f) => parseFileSpec(f));
    if (specs.find((spec) => spec.type != "raw")) {
      throw new Error("invalid input, only .enum.csv or .perm.csv files supported");
    }

    for (const spec of specs) {
      const { binFile, depsFile, outDir, compile } = getOutFiles(spec.path, opts.out);
      const { blob, deps } = await compile(spec.path);

      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(binFile, blob, "binary");
      console.log(`blob saved to ${binFile}`);
      fs.writeFileSync(depsFile, JSON.stringify(deps));
      console.log(`deps saved to ${depsFile}`);
    }
  });

const matterHashCmd = new Command("hash")
  .description("Compute matter hashes")
  .argument("<files...>", "Paths of matter blob files")
  .addOutputOptions()
  .action(async function (files) {
    const opts = this.opts();
    const console = new Logger(opts);
    const seen = new Set<string>();
    const outputs: HashOutput[] = [];
    for (const file of files) {
      const spec = parseFileSpec(file);
      const inputs = await toRegisterInput(spec);
      inputs.forEach((input) => {
        if (!seen.has(input.path)) {
          seen.add(input.path);

          const { form, mime, path } = input;
          const blob = input.blob || loadBinary(path);
          const hash = computeHash(form, mime, blob);
          outputs.push({ hash, form, mime, path });
        }
      });
    }
    console.log(columify(outputs));
    console.result(outputs);
  });

export const matterPickCmd = new Command("pick")
  .description("Pick matter hashes from a hash output file")
  .argument("<files...>", "Paths of the matter files")
  .option("--from <file>", "Path to the hash output file", "register/hashes.json")
  .action(function (files: string[]) {
    const opts = this.opts<{ from: string }>();
    const list = loadJson(opts.from);
    if (!Array.isArray(list)) throw new Error(`Expected an array in ${opts.from}`);
    const hashes = list as { path: string; hash: string }[];
    const result = files.map((file) => {
      const rec = hashes.find((r) => r.path === file);
      if (!rec) throw new Error(`No hash found for: ${file}`);
      return rec.hash;
    });
    console.log(result.join(" "));
  });

export const matterCmd = new Command("matter")
  .description("matter utilities")
  .addCommand(matterRegisterCmd)
  .addCommand(matterCompileCmd)
  .addCommand(matterHashCmd)
  .addCommand(matterPickCmd);

type MatterFileType = "blob" | "manifest" | "raw";

interface MatterFileSpec {
  path: string;
  type: MatterFileType;
  form?: number;
  mime?: string;
}

interface MatterMeta {
  form: number;
  mime: string;
}

interface RegisterInput {
  path: string;
  form: number;
  mime: string;
  blob?: Buffer;
}

interface HashOutput {
  hash: `0x${string}`;
  path: string;
  form: number;
  mime: string;
}

function parseFileSpec(file: string): MatterFileSpec {
  if (file.startsWith("@")) {
    const p = file.slice(1).trim();
    if (!p) throw new Error("Invalid manifest file spec (empty path)");
    return { path: p, type: "manifest" };
  }

  const parts = file.split(":");
  if (parts.length < 1 || parts.length > 3) {
    throw new Error(`Invalid matter spec: ${file}`);
  }

  const pathPart = parts[0];
  let form: number | undefined;
  let mime: string | undefined;
  parts.slice(1).forEach((part) => {
    if (part.startsWith("form=")) {
      form = Number(part.slice(5));
    } else if (part.startsWith("mime=")) {
      mime = part.slice(5);
    } else {
      throw new Error(`Invalid extra info: ${part}`);
    }
  });

  const type = pathPart.endsWith(".enum.csv") || pathPart.endsWith(".perm.csv") ? "raw" : "blob";
  return { path: pathPart, type, form, mime };
}

async function toRegisterInput(spec: MatterFileSpec): Promise<RegisterInput[]> {
  if (spec.type == "blob") {
    if (spec.form && spec.mime) return [{ path: spec.path, form: spec.form, mime: spec.mime }];
    const g = inferMatterMeta(spec.path);
    return [{ path: spec.path, form: spec.form ?? g.form, mime: spec.mime ?? g.mime }];
  } else if (spec.type == "manifest") {
    return loadJson(spec.path).map((item: { path: string; form?: number; mime?: string }) => {
      const { path, form, mime } = item;
      return { path, form, mime } as RegisterInput;
    });
  } else if (spec.type == "raw") {
    if (spec.path.endsWith(".enum.csv")) {
      const { blob, deps } = await compileEnumMatter(spec.path);
      const path = spec.path.slice(0, -9) + ".enum.bin";
      const { form, mime } = inferMatterMeta(path);
      return [...(deps as RegisterInput[]), { blob, form, mime, path }];
    } else if (spec.path.endsWith(".perm.csv")) {
      const { blob, deps } = await compileEnumMatter(spec.path);
      const path = spec.path.slice(0, -9) + ".perm.bin";
      const { form, mime } = inferMatterMeta(path);
      return [...(deps as RegisterInput[]), { blob, form, mime, path }];
    } else {
      throw new Error("unknown raw matter file extension");
    }
  } else {
    throw new Error("unknown matter file type");
  }
}

function getOutFiles(
  file: string,
  outDir?: string
): {
  binFile: string;
  depsFile: string;
  outDir: string;
  compile: (file: string) => Promise<{ blob: Buffer; deps: RegisterInput[] }>;
} {
  const dir = outDir ? path.resolve(outDir) : path.dirname(path.resolve(file));
  if (file.endsWith(".enum.csv")) {
    const baseName = path.basename(file).slice(0, -9);
    const binFile = path.join(dir, `${baseName}.enum.bin`);
    const depsFile = path.join(dir, `${baseName}.enum.deps`);
    return { binFile, depsFile, outDir: dir, compile: compileEnumMatter };
  } else if (file.endsWith(".perm.csv")) {
    const baseName = path.basename(file).slice(0, -9);
    const binFile = path.join(dir, `${baseName}.perm.bin`);
    const depsFile = path.join(dir, `${baseName}.perm.deps`);
    return { binFile, depsFile, outDir: dir, compile: compilePermMatter };
  } else {
    throw new Error("Unsupported raw matter file extension");
  }
}

async function compileEnumMatter(file: string): Promise<{ blob: Buffer; deps: RegisterInput[] }> {
  const computeHashMemo = memoize(computeHashFile);

  const deps = new Map<string, RegisterInput>();
  let rows = 0;
  let colTypes: string[];

  const mapHeaders = ({ header }: { header: string }) => {
    const h = header.trim().toUpperCase();
    if (h in CELL_FORMS) {
      return h;
    } else {
      throw new Error(`Invalid column element type: ${h}`);
    }
  };

  function resolvePath(v: string): string {
    if (path.isAbsolute(v)) return v;
    const dir = path.dirname(file);
    if (path.isAbsolute(file)) {
      return path.resolve(dir, v);
    } else {
      return path.normalize(path.join(dir, v));
    }
  }

  const mapValues = ({ header, value }: { header: string; value: string }) => {
    const v = value.trim();
    if (v.startsWith("0x")) {
      return fromHex(pad(v as `0x${string}`, { size: 32, dir: "left" }), "bytes");
    } else if (header == "IMAGE" || header == "JSON") {
      const { hash, mime, form, path } = computeHashMemo(resolvePath(v));
      if (!deps.has(path)) {
        deps.set(path, { hash, mime, form, path } as RegisterInput);
      }
      return fromHex(hash, "bytes");
    } else {
      throw new Error("expect hex strings for cols other than IMAGE, JSON");
    }
  };

  const aux = parseAuxData(file, { mapValues, mapHeaders });
  const parser = csv({ skipComments: true, strict: true, mapHeaders, mapValues });
  const blob: Buffer = await new Promise((resolve, reject) => {
    const content: Uint8Array[] = [];
    fs.createReadStream(file)
      .pipe(parser)
      .on("headers", (headers) => {
        colTypes = headers;
      })
      .on("data", (data) => {
        Object.values<Uint8Array>(data).forEach((value) => content.push(value));
        rows += 1;
      })
      .on("end", () => {
        const auxTypes = Object.keys(aux ?? {});
        const auxValues = Object.values(aux ?? {});
        const enumHeader = buildEnumHeader(auxTypes ?? [], colTypes ?? [], rows);
        resolve(Buffer.concat([enumHeader, ...auxValues, ...content]));
      })
      .on("error", (e: any /* eslint-disable-line */) => {
        reject(e);
      });
  });

  return { blob, deps: Array.from(deps.values()) };
}

async function compilePermMatter(file: string): Promise<{ blob: Buffer; deps: RegisterInput[] }> {
  void file;
  throw new Error("unimplemented");
}

function computeHash(form: number, mime: string, blob: Uint8Array): `0x${string}` {
  if (form < 0 || form > 255) {
    throw new Error("form must be uint8 (0..255)");
  }
  const mimeUTF8 = new TextEncoder().encode(mime);
  if (mimeUTF8.length <= 0 || mimeUTF8.length > 31) {
    throw new Error("form must be uint8 (0..255)");
  }

  const msg = new Uint8Array(32 + blob.length);
  msg[0] = form & 0xff;
  msg.set(pad(mimeUTF8, { size: 32, dir: "right" }), 1);
  msg.set(blob, 32);
  // SHA256(form:1 || mime:31 || blob:var)
  return sha256(msg);
}

function computeHashFile(file: string): HashOutput {
  const spec = parseFileSpec(file);
  if (spec.type != "blob") {
    throw new Error("not blob type");
  }

  let form, mime;
  if (spec.form && spec.mime) {
    form = spec.form;
    mime = spec.mime;
  } else {
    const g = inferMatterMeta(spec.path);
    form = spec.form ?? g.form;
    mime = spec.mime ?? g.mime;
  }

  const hash = computeHash(form, mime, loadBinary(spec.path));
  return { path: spec.path, form, mime, hash };
}

/**
 * Build a 32-byte EnumMatter header.
 * Layout:
 *   [0..3]   = "ENUM"
 *   [4]      = ver, aux (u8.hi4, u8.lo4)
 *   [5]      = cols (u8)
 *   [6..7]   = rows (u16 LE)
 *   [8..15]  = aux_types [u8; 8]
 *   [16..31] = col_types [u8; 16]
 */
function buildEnumHeader(auxTypes: string[], colTypes: string[], rows = 0): Uint8Array {
  const colTypesLen = colTypes.length;
  const auxTypesLen = auxTypes.length;
  if (colTypesLen + auxTypesLen == 0) {
    throw new Error("Empty header list");
  }
  if (auxTypesLen > 8) {
    throw new Error(`Too many aux types (max 8): ${auxTypesLen}`);
  }
  if (colTypesLen > 16) {
    throw new Error(`Too many column types (max 16): ${colTypesLen}`);
  }
  if (rows < 0 || rows > 0xffff) {
    throw new Error(`Rows out of range: ${rows}`);
  }
  const buf = new Uint8Array(32);
  buf.set([0x45, 0x4e, 0x55, 0x4d], 0); // magic "ENUM"
  buf[4] = (0x01 << 4) | (auxTypesLen & 0x0f); // version(hi4), aux(lo4)
  buf[5] = colTypesLen; // cols
  buf[6] = rows & 0xff; // rows.lo
  buf[7] = (rows >>> 8) & 0xff; // rows.hi
  auxTypes.forEach((t, i) => (buf[8 + i] = formByName(t))); // aux types
  colTypes.forEach((t, i) => (buf[16 + i] = formByName(t))); // col types
  return buf;
}

const MATTER_FORMS: Record<string, number> = {
  // Simple
  JSON: 0x01,
  IMAGE: 0x02,
  // Code
  WASM: 0xc0,
  // Data
  ENUM: 0xd0,
  PERM: 0xd1,
  // Info
  INFO: 0xff,
} as const;

const CELL_FORMS: Record<string, number> = {
  JSON: 0x01,
  IMAGE: 0x02,
  INFO: 0xff,
} as const;

function formByName(name: string): number {
  const value = MATTER_FORMS[name as keyof typeof MATTER_FORMS];
  if (value === undefined) {
    throw new Error(`Invalid form name: "${name}"`);
  }
  return value;
}

function inferMatterMeta(filePath: string): MatterMeta {
  const ext = path.extname(filePath);
  switch (ext) {
    case ".wasm":
      return { mime: "application/wasm", form: MATTER_FORMS.WASM };
    case ".json":
      return { mime: "application/json", form: MATTER_FORMS.JSON };
    case ".jpg":
      return { mime: "image/jpeg", form: MATTER_FORMS.IMAGE };
    case ".jpeg":
      return { mime: "image/jpeg", form: MATTER_FORMS.IMAGE };
    case ".png":
      return { mime: "image/png", form: MATTER_FORMS.IMAGE };
    case ".bin":
      if (filePath.endsWith(".enum.bin")) {
        return { mime: "application/vnd.every.enum", form: MATTER_FORMS.ENUM };
      } else if (filePath.endsWith(".perm.bin")) {
        return { mime: "application/vnd.every.perm", form: MATTER_FORMS.PERM };
      } else {
        throw new Error("unknown matter file extension");
      }
    default:
      throw new Error("unknown matter file extension");
  }
}

type MapHeadersFn = (args: { header: string; index: number }) => string | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapValuesFn = (args: { header: string; index: number; value: string }) => any;

interface ParserOptions {
  mapHeaders?: MapHeadersFn;
  mapValues?: MapValuesFn;
}

function parseAuxData(filePath: string, options: ParserOptions): { [key: string]: Uint8Array } | undefined {
  const lines = readPrologue(filePath)
    .filter((l) => /^\s*#\s*@aux\s+/i.test(l))
    .map((l) => l.replace(/^\s*#\s*@aux\s+/i, "").trim());
  const mapHeaders: MapHeadersFn = options.mapHeaders ?? (({ header }) => header);
  const mapValues: MapValuesFn = options.mapValues ?? (({ value }) => value);
  if (lines.length == 0) {
    return undefined;
  } else if (lines.length == 2) {
    const headers = lines[0].split(",").map((header, index) => mapHeaders({ header, index }));
    const parts = lines[1].split(",");
    if (parts.length != headers.length) {
      throw new Error("aux header and values mismatch");
    }
    const values = parts.map((value, index) => mapValues({ header: headers[index]!, index, value }));
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  } else {
    throw new Error("invalid aux data");
  }
}

function readPrologue(filePath: string, maxBytes = 2048): string[] {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(maxBytes);
  const bytesRead = fs.readSync(fd, buf, 0, maxBytes, 0);
  fs.closeSync(fd);
  const lines = buf.subarray(0, bytesRead).toString("utf8").split(/\r?\n/);
  const prologue: string[] = [];
  for (const line of lines) {
    if (line.trim().startsWith("#")) {
      prologue.push(line);
    } else if (line.trim().length > 0) {
      break; // stop at the first non-comment, non-empty line
    }
  }
  return prologue;
}
