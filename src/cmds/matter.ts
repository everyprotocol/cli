import { Command } from "commander";
import "@polkadot/api-augment/substrate";
import * as fs from "fs";
import * as JSON11 from "json11";
import columify from "columnify";
import { computeMatterHash, guessContentType, loadBinary } from "../utils.js";
import { submitTransaction } from "../substrate.js";
import { network } from "../commander-patch.js";
import { Logger } from "../logger.js";

const matterRegisterCmd = new Command("register")
  .description("Register matter on the Substrate chain")
  .argument("<files...>", "Paths of matter blob files")
  .option("--mime <string>", "Matter mime")
  .option("--form <number>", "Matter form", "1")
  .addOption(network)
  .addKeystoreOptions()
  .addOutputOptions()
  .subWriteAction(async function (api, pair, files) {
    const opts = this.opts();
    const console = new Logger(opts);
    const materials = [];
    for (const file of files) {
      const [filePath, form_, mime_] = file.split(":");
      const form = Number(form_ ?? opts.form ?? "1");
      const mime = mime_ || opts.mime || guessContentType(filePath);
      materials.push({ filePath, form, mime });
    }

    const txns = [];
    for (const { filePath, form, mime } of materials) {
      const content = fs.readFileSync(filePath);
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
      const events = r.events.map((e) => [e.event.method, JSON11.stringify(e.event.data.toJSON())]);
      const receipt = r.events.map((e) => ({ event: e.event.method, data: e.event.data.toJSON() }));
      console.log(columify(events, { showHeaders: false }));
      result.push({
        file: filePath,
        transaction: txn.txHash,
        events: receipt,
      });
    }
    console.result(result);
  });

const matterHashCmd = new Command("hash")
  .description("Register matter on the Substrate chain")
  .argument("<files...>", "Paths of matter blob files")
  .option("--mime <string>", "Matter mime")
  .option("--form <number>", "Matter form", "1")
  .addOutputOptions()
  .action(async function (files) {
    const opts = this.opts();
    const console = new Logger(opts);
    const matters = [];
    for (const file of files) {
      const [path, form_, mime_] = file.split(":");
      const form = Number(form_ ?? opts.form ?? "1");
      const mime = mime_ || opts.mime || guessContentType(path);
      const blob = loadBinary(path);
      const hash = computeMatterHash(form, mime, blob);
      matters.push({ hash, form, mime, blob: blob.length, path });
    }
    console.log(columify(matters));
    console.result(matters);
  });

export const matterCmd = new Command("matter")
  .description("matter utilities")
  .addCommand(matterRegisterCmd)
  .addCommand(matterHashCmd);
