import { Command } from "commander";
import { ApiPromise, WsProvider } from "@polkadot/api";
import "@polkadot/api-augment/substrate";
import * as fs from "fs";
import * as path from "path";
import * as JSON11 from "json11";
import columify from "columnify";
import { Observer } from "./config.js";
import { getObserverConfig, keystoreFromOptions } from "./utils.js";
import { submitTransaction } from "./substrate.js";
import { optNetwork } from "./options.js";

const registerCmd = new Command("register")
  .description("Register matter on the Substrate chain")
  .argument("<files...>", "Path to the file(s) containing the matter content")
  .option("-c, --content-type <type>", "Default content type")
  .option("-h, --hasher <number>", "Default hasher", "1")
  .accountOptions()
  .addOption(optNetwork)
  .action(async (files, options) => {
    const materials = [];
    for (const file of files) {
      const [filePath, hasher_, contentType_] = file.split(":");
      const hasher = hasher_ ? Number(hasher_) : Number(options.hasher) || 1;
      const contentType = contentType_ || options.contentType || guessContentType(filePath);
      materials.push({ filePath, hasher, contentType });
    }

    const conf: Observer = getObserverConfig(options);
    const keystore = await keystoreFromOptions(options);
    const pair = await keystore.pair();
    const provider = new WsProvider(conf.rpc);
    const api = await ApiPromise.create({ provider });
    const txns = [];

    // Submit transactions for each material
    for (const { filePath, hasher, contentType } of materials) {
      console.log(`Register matter: ${filePath}: mime=${contentType}, form=${hasher}`);
      const content = fs.readFileSync(filePath);
      const contentRaw = api.createType("Raw", content, content.length);
      const call = api.tx.every.matterRegister(hasher, contentType, contentRaw);
      console.log(`Transaction submitting...`);
      const txn = await submitTransaction(api, call, pair);
      console.log(`Transaction submitted: ${txn.txHash}`);
      txns.push({ txn, filePath });
    }
    console.log(`Transaction mining...`);
    for (const { txn, filePath } of txns) {
      const r = await txn.receipt;
      const header = await api.rpc.chain.getHeader(r.blockHash);
      const block = { block: header.number, hash: r.blockHash };
      console.log(`Transaction confirmed: ${txn.txHash} ${filePath}`);
      console.log(`At block: ${JSON11.stringify(block)}`);
      const events = r.events.map((e) => [e.event.method, JSON11.stringify(e.event.data.toJSON())]);
      console.log(columify(events, { showHeaders: false }));
    }

    await api.disconnect();
  });

export const matterCmd = new Command("matter").description("manage matters").addCommand(registerCmd);

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
