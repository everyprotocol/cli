import { Command } from "commander";
import "@polkadot/api-augment/substrate";
import * as fs from "fs";
import * as path from "path";
import * as JSON11 from "json11";
import columify from "columnify";
import { getSubstrateApi, keystoreFromOptions } from "../utils.js";
import { submitTransaction } from "../substrate.js";
import { optNetwork } from "../options.js";

const matterRegisterCmd = new Command("register")
  .description("Register matter on the Substrate chain")
  .argument("<files...>", "Paths of matter blob files")
  .option("--mime <string>", "Matter mime")
  .option("--form <number>", "Matter form", "1")
  .accountOptions()
  .addOption(optNetwork)
  .action(async (files, options) => {
    const materials = [];
    for (const file of files) {
      const [filePath, form_, mime_] = file.split(":");
      const form = Number(form_ ?? options.form ?? "1");
      const mime = mime_ || options.mime || guessContentType(filePath);
      materials.push({ filePath, form, mime });
    }

    const keystore = await keystoreFromOptions(options);
    const pair = await keystore.pair();
    const api = await getSubstrateApi(options);
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
    for (const { txn, filePath } of txns) {
      const r = await txn.receipt;
      const header = await api.rpc.chain.getHeader(r.blockHash);
      console.log(`Transaction confirmed: ${txn.txHash} ${filePath}`);
      console.log(`Confirmed in: block ${header.number}, hash ${header.hash}`);
      const events = r.events.map((e) => [e.event.method, JSON11.stringify(e.event.data.toJSON())]);
      console.log(columify(events, { showHeaders: false }));
    }

    await api.disconnect();
  });

export const matterCmd = new Command("matter").description("manage matters").addCommand(matterRegisterCmd);

function guessContentType(filePath: string): string {
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
