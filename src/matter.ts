import * as fs from "fs";
import { loadBinary, loadJson } from "./utils.js";
import path from "path";
import csv from "csv-parser";
import { fromHex, pad, sha256 } from "viem";
import { memoize } from "lodash-es";

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

const CELL_TYPES: Record<string, number> = {
  JSON: 0x01,
  IMAGE: 0x02,
  INFO: 0xff,
} as const;

export type MatterFileType = "blob" | "manifest" | "raw";

export interface MatterRegisterSpec {
  path: string;
  type: MatterFileType;
  form?: number;
  mime?: string;
}

interface MatterMeta {
  form: number;
  mime: string;
}

export interface MatterRegisterInput {
  path: string;
  form: number;
  mime: string;
  blob?: Buffer;
}

export interface MatterHashOutput {
  hash: `0x${string}`;
  path: string;
  form: number;
  mime: string;
}

export function formValueByName(name: string): number {
  const value = MATTER_FORMS[name as keyof typeof MATTER_FORMS];
  if (value === undefined) {
    throw new Error(`Invalid form name: "${name}"`);
  }
  return value;
}

export function metaFromExt(file: string): MatterMeta {
  const ext = path.extname(file);
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
      if (file.endsWith(".enum.bin")) {
        return { mime: "application/vnd.every.enum", form: MATTER_FORMS.ENUM };
      } else if (file.endsWith(".perm.bin")) {
        return { mime: "application/vnd.every.perm", form: MATTER_FORMS.PERM };
      } else {
        throw new Error("unknown matter file extension");
      }
    default:
      throw new Error("unknown matter file extension");
  }
}

export function computeHash(form: number, mime: string, blob: Uint8Array): `0x${string}` {
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

export function computeHashFromFile(file: string): MatterHashOutput {
  const spec = parseFileSpec(file);
  if (spec.type != "blob") {
    throw new Error("not blob type");
  }

  let form, mime;
  if (spec.form && spec.mime) {
    form = spec.form;
    mime = spec.mime;
  } else {
    const g = metaFromExt(spec.path);
    form = spec.form ?? g.form;
    mime = spec.mime ?? g.mime;
  }

  const hash = computeHash(form, mime, loadBinary(spec.path));
  return { path: spec.path, form, mime, hash };
}

export function parseFileSpec(file: string): MatterRegisterSpec {
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

export async function specToInput(spec: MatterRegisterSpec): Promise<MatterRegisterInput[]> {
  if (spec.type == "blob") {
    if (spec.form && spec.mime) return [{ path: spec.path, form: spec.form, mime: spec.mime }];
    const meta = metaFromExt(spec.path);
    return [{ path: spec.path, form: spec.form ?? meta.form, mime: spec.mime ?? meta.mime }];
  } else if (spec.type == "manifest") {
    return loadJson(spec.path).map((item: { path: string; form?: number; mime?: string }) => {
      const { path, form, mime } = item;
      return { path, form, mime } as MatterRegisterInput;
    });
  } else if (spec.type == "raw") {
    if (spec.path.endsWith(".enum.csv")) {
      const { blob, deps } = await compileEnumCsv(spec.path);
      const path = spec.path.slice(0, -9) + ".enum.bin";
      const { form, mime } = metaFromExt(path);
      return [...(deps as MatterRegisterInput[]), { blob, form, mime, path }];
    } else if (spec.path.endsWith(".perm.csv")) {
      const { blob, deps } = await compilePermCsv(spec.path);
      const path = spec.path.slice(0, -9) + ".perm.bin";
      const { form, mime } = metaFromExt(path);
      return [...(deps as MatterRegisterInput[]), { blob, form, mime, path }];
    } else {
      throw new Error("unknown raw matter file extension");
    }
  } else {
    throw new Error("unknown matter file type");
  }
}

type CsvCell = {
  cell: string;
  type: "hex" | "file";
  hex?: `0x${string}`;
  file?: string;
};

type PermCsvCell = {
  cell: string;
  type: "hex" | "file" | "empty";
  hex?: `0x${string}`;
  file?: string;
  count: number;
};

type PermCsvHeader = {
  header: string;
  perm: boolean;
  index: number;
};

export async function compileEnumCsv(csvFile: string): Promise<{ blob: Buffer; deps: MatterRegisterInput[] }> {
  const deps = new Map<string, MatterRegisterInput>();
  const hashCellFileMemo = HashCellFileMemo(csvFile, deps);

  const mapHeaders = ({ header }: { header: string }) => parseCsvHeader(header);
  const mapValues = ({ header, value }: { header: string; value: string }) => {
    const c = parseCsvCell(value, header);
    if (c.type == "hex") {
      const bin = fromHex(pad(c.hex!, { size: 32, dir: "left" }), "bytes");
      return bin;
    } else if (c.type == "file") {
      const input = hashCellFileMemo(c.file!);
      const bin = fromHex(input.hash, "bytes");
      return bin;
    }
  };

  const aux = parseCsvAux(csvFile, hashCellFileMemo);

  const rows: Uint8Array[][] = [];
  const headers: string[] = [];
  const blob: Buffer = await new Promise((resolve, reject) => {
    fs.createReadStream(csvFile)
      .pipe(csv({ skipComments: true, strict: true, mapHeaders, mapValues }))
      .on("error", (e) => reject(e))
      .on("headers", (hs) => headers.push(...hs))
      .on("data", (data) => rows.push(Object.values<Uint8Array>(data)))
      .on("end", () => {
        const auxTypes = Object.keys(aux ?? {});
        const auxData = Object.values(aux ?? {});
        const header = buildEnumBinHeader(auxTypes ?? [], headers, rows.length);
        resolve(Buffer.concat([header, ...auxData, ...rows.flat()]));
      });
  });

  return { blob, deps: Array.from(deps.values()) };
}

export async function compilePermCsv(csvFile: string): Promise<{ blob: Buffer; deps: MatterRegisterInput[] }> {
  const deps = new Map<string, MatterRegisterInput>();
  const hashCellFileMemo = HashCellFileMemo(csvFile, deps);

  const headers: PermCsvHeader[] = [];
  const columns: Uint8Array[][] = [];
  const mapHeaders = (header: { header: string; index: number }) => {
    const h = parsePermCsvHeader(header);
    headers.push(h);
    return h.header;
  };
  const mapValues = ({ header, value, index }: { header: string; value: string; index: number }) => {
    const v = parsePermCsvCell(value, header);
    const bin =
      v.type == "hex"
        ? fromHex(pad(v.hex!, { size: 32, dir: "left" }), "bytes")
        : v.type == "file"
          ? fromHex(hashCellFileMemo(v.file!).hash, "bytes")
          : null;
    if (bin) for (let i = 0; i < v.count; i++) columns[index].push(bin);
    return v.cell;
  };

  const aux = parseCsvAux(csvFile, hashCellFileMemo);

  const blob: Buffer = await new Promise((resolve, reject) => {
    fs.createReadStream(csvFile)
      .pipe(csv({ skipComments: true, strict: false, mapHeaders, mapValues }))
      .on("error", (e) => reject(e))
      .on("headers", (hs) => hs.forEach(() => columns.push([])))
      .on("data", (data) => void data) // event must be subscribed, so that "end" works
      .on("end", () => {
        validatePermColumns(headers, columns);
        const auxTypes = Object.keys(aux ?? {});
        const auxData = Object.values(aux ?? {});
        const header = buildPermBinHeader(auxTypes, headers, columns);
        resolve(Buffer.concat([header, ...auxData, ...columns.flat()]));
      });
  });
  return { blob, deps: Array.from(deps.values()) };
}

function validatePermColumns(headers: PermCsvHeader[], columns: Uint8Array[][]): void {
  const n = headers.length;
  if (n !== columns.length) throw new Error("headers/columns length mismatch");

  const sizes = columns.map((c) => c.length);
  const permIdxs = headers.map((h, i) => (h.perm ? i : -1)).filter((i) => i >= 0);
  const prod = permIdxs.reduce((acc, cur) => acc * sizes[cur], 1);
  if (prod === 0) throw new Error("column height cannot be zero for permutation columns");

  const ensureAllEqual = (idxs: number[], expected?: number) => {
    if (idxs.length === 0) return;
    const ref = expected ?? sizes[idxs[0]];
    for (const i of idxs) {
      if (sizes[i] !== ref) {
        throw new Error(`column heights mismatch: column ${i} has ${sizes[i]} but expected ${ref}`);
      }
      if (sizes[i] === 0) {
        throw new Error(`column height cannot be zero (column ${i})`);
      }
    }
  };

  const nonPermIdxs = headers.map((h, i) => (!h.perm ? i : -1)).filter((i) => i >= 0);
  ensureAllEqual(nonPermIdxs, permIdxs.length === 0 ? undefined : prod);
}

/**
 * Build an EnumMatter header.
 * Layout:
 *   [0..3]   = "ENUM"
 *   [4]      = ver, aux (u8.hi4, u8.lo4)
 *   [5]      = cols (u8)
 *   [6..7]   = rows (u16 LE)
 *   [8..15]  = aux_types [u8; 8]
 *   [16..31] = col_types [u8; 16]
 */
export function buildEnumBinHeader(auxTypes: string[], colTypes: string[], rows = 0): Uint8Array {
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
  auxTypes.forEach((t, i) => (buf[8 + i] = formValueByName(t))); // aux types
  colTypes.forEach((t, i) => (buf[16 + i] = formValueByName(t))); // col types
  return buf;
}

/**
 * Build a PermMatter header.
 * Layout:
 *   [0..3]   = "PERM"
 *   [4]      = ver, aux (u8.hi4, u8.lo4)
 *   [5]      = cols (u8)
 *   [6..7]   = enum_cols (16 bits)
 *   [8..15]  = aux_types [u8; 8]
 *   [16..31] = col_types [u8; 16]
 *   [32..64] = col_heights [u16; 16]
 */
export function buildPermBinHeader(auxTypes: string[], headers: PermCsvHeader[], columns: Uint8Array[][]): Uint8Array {
  if (auxTypes.length > 8) {
    throw new Error(`Too many aux types (max 8): ${auxTypes.length}`);
  }
  if (headers.length > 16) {
    throw new Error(`Too many column types (max 16): ${headers.length}`);
  }
  if (columns.length != headers.length) {
    throw new Error(`Headers and columns mismatch`);
  }
  const buf = new Uint8Array(columns.length > 0 ? 64 : 32);
  buf.set([0x50, 0x45, 0x52, 0x4d], 0); // magic "ENUM"
  buf[4] = (0x01 << 4) | (auxTypes.length & 0x0f); // version(hi4), aux(lo4)
  buf[5] = headers.length; // cols
  const bits: number = headers.reduce<number>((prev, current, i) => {
    return prev | (!current.perm ? 1 << (15 - i) : 0);
  }, 0);
  buf[6] = bits & 0xff; // bits.lo
  buf[7] = (bits >>> 8) & 0xff; // bits.hi
  auxTypes.forEach((t, i) => (buf[8 + i] = formValueByName(t))); // aux types
  headers.forEach((h, i) => (buf[16 + i] = formValueByName(h.header))); // col types
  columns.forEach((c, i) => {
    const loByte = c.length & 0xff;
    const hiByte = (c.length >>> 8) & 0xff;
    buf[32 + i * 2] = loByte;
    buf[32 + i * 2 + 1] = hiByte;
  });
  return buf;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCsvAux(filePath: string, hashCellFileMemo: any): { [key: string]: Uint8Array } | undefined {
  const lines = readPrologue(filePath)
    .filter((l) => /^\s*#\s*@aux\s+/i.test(l))
    .map((l) => l.replace(/^\s*#\s*@aux\s+/i, "").trim());

  const mapHeaders = ({ header }: { header: string; index: number }) => parseCsvHeader(header);
  const mapValues = ({ header, value }: { header: string; value: string; index: number }) => {
    const c = parseCsvCell(value, header);
    if (c.type == "hex") {
      const bin = fromHex(pad(c.hex!, { size: 32, dir: "left" }), "bytes");
      return bin;
    } else {
      const input = hashCellFileMemo(c.file!);
      const bin = fromHex(input.hash, "bytes");
      return bin;
    }
  };
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

function parseCsvHeader(header: string) {
  const h = header.trim().toUpperCase();
  if (h in CELL_TYPES) {
    return h;
  } else {
    throw new Error(`Invalid element type: ${h}`);
  }
}

function parseCsvCell(input: string, header: string): CsvCell {
  const cell = input.trim();
  if (cell.length == 0) throw new Error("empty cell not permitted");
  // (0xHEX | FILE) [* NUMBER] with optional spaces around *
  const re = /^(?:(0x[0-9A-Fa-f]+)|([^\s*]+))$/;
  const m = cell.match(re);
  if (!m) throw new Error("invalid cell");
  const [, hex, file] = m;
  if (hex) {
    if ((hex.length - 2) % 2 !== 0 || hex.length > 66) throw new Error("invalid hex cell");
    return { cell, type: "hex", hex: hex as `0x${string}`, file: undefined };
  } else {
    if (header == "INFO") {
      throw new Error("file not permitted for INFO cell");
    }
    return { cell, type: "file", hex: undefined, file };
  }
}

function parsePermCsvHeader({ header, index }: { header: string; index: number }) {
  let h = header.trim().toUpperCase();
  let perm = true;
  if (h.endsWith("!")) {
    h = h.slice(0, -1);
    perm = false;
  }
  if (h in CELL_TYPES) {
    return { header: h, perm, index };
  } else {
    throw new Error(`Invalid column type: ${h}`);
  }
}

export function parsePermCsvCell(input: string, header: string): PermCsvCell {
  const cell = input.trim();
  if (cell.length == 0) return { cell, type: "empty", count: 0 };

  // (0xHEX | FILE) [* NUMBER] with optional spaces around *
  const re = /^(?:(0x[0-9A-Fa-f]+)|([^\s*]+))\s*(?:\*\s*(\d+))?$/;
  const m = cell.match(re);
  if (!m) throw new Error("invalid cell");
  const [, hex, file, num] = m;

  if (hex) {
    if ((hex.length - 2) % 2 !== 0 || hex.length > 66) throw new Error("invalid hex cell");
    return {
      cell,
      type: "hex",
      hex: hex as `0x${string}`,
      file: undefined,
      count: num ? Number(num) : 1,
    };
  } else {
    if (header == "INFO") {
      throw new Error("file cell not permitted for INFO column");
    }
    return {
      cell,
      type: "file",
      hex: undefined,
      file,
      count: num ? Number(num) : 1,
    };
  }
}

export function resolveCellPath(csvFile: string) {
  return function (cellFile: string): string {
    if (path.isAbsolute(cellFile)) return cellFile;
    const dir = path.dirname(csvFile);
    if (path.isAbsolute(csvFile)) {
      return path.resolve(dir, cellFile);
    } else {
      return path.normalize(path.join(dir, cellFile));
    }
  };
}

function HashCellFileMemo(csvFile: string, deps: Map<string, MatterRegisterInput>) {
  const resolvePath = resolveCellPath(csvFile);
  function hashCellFile(p: string): MatterHashOutput {
    const input = computeHashFromFile(resolvePath(p));
    if (!deps.has(input.path)) {
      deps.set(input.path, input);
    }
    return input;
  }
  return memoize(hashCellFile);
}
