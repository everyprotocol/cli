import { Command, Option } from "commander";
import "@polkadot/api-augment/substrate";
import * as fs from "fs";
import path from "path";
import columify from "columnify";
import { j11String, loadBinary, loadJson } from "../utils.js";
import { submitTransaction } from "../substrate.js";
import { Logger } from "../logger.js";
import {
  compileEnumCsv,
  compilePermCsv,
  computeHash,
  MatterHashOutput,
  MatterRegisterInput,
  parseFileSpec,
  specToInput,
} from "../matter.js";

const universe = new Option("-u, --universe <universe>", "Universe name");
const network = new Option("-n, --network <network>", "Network name");

const matterRegisterCmd = new Command("register")
  .description("Register matters")
  .argument("<files...>", "Paths of matter blob files")
  .addOption(network)
  .addOption(universe)
  .addKeystoreOptions()
  .addOutputOptions()
  .subWriteAction(async function (api, pair, files) {
    const opts = this.opts();
    const console = new Logger(opts);
    const deduper = new Set<string>();
    const inputs: MatterRegisterInput[] = [];
    for (const file of files) {
      const spec = parseFileSpec(file);
      const mi = await specToInput(spec);
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
      const events = r.events.map((e: any) => [e.event.method, j11String(e.event.data.toJSON())]);
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
    const outputs: MatterHashOutput[] = [];
    for (const file of files) {
      const spec = parseFileSpec(file);
      const inputs = await specToInput(spec);
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

function getOutFiles(
  file: string,
  outDir?: string
): {
  binFile: string;
  depsFile: string;
  outDir: string;
  compile: (file: string) => Promise<{ blob: Buffer; deps: MatterRegisterInput[] }>;
} {
  const dir = outDir ? path.resolve(outDir) : path.dirname(path.resolve(file));
  if (file.endsWith(".enum.csv")) {
    const baseName = path.basename(file).slice(0, -9);
    const binFile = path.join(dir, `${baseName}.enum.bin`);
    const depsFile = path.join(dir, `${baseName}.enum.deps`);
    return { binFile, depsFile, outDir: dir, compile: compileEnumCsv };
  } else if (file.endsWith(".perm.csv")) {
    const baseName = path.basename(file).slice(0, -9);
    const binFile = path.join(dir, `${baseName}.perm.bin`);
    const depsFile = path.join(dir, `${baseName}.perm.deps`);
    return { binFile, depsFile, outDir: dir, compile: compilePermCsv };
  } else {
    throw new Error("Unsupported raw matter file extension");
  }
}
