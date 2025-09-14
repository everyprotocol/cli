import { Command } from "commander";
import { ApiPromise, WsProvider } from "@polkadot/api";
import "@polkadot/api-augment/substrate";
import * as fs from "fs";
import * as path from "path";
import { Observer } from "./config.js";
import { getObserverConfig, keystoreFromOptions } from "./utils.js";
import "./options.js";
import { findEvent, submitTransaction } from "./substrate.js";
import JSON5 from "json5";

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

export function genMatterCommand() {
  const cmd = new Command().name("matter").description("manage matters");

  cmd
    .command("register")
    .description("Register matter on the Substrate chain")
    .argument("<files...>", "Path to the file(s) containing the matter content")
    .option("-c, --content-type <type>", "Default content type")
    .option("-h, --hasher <number>", "Default hasher", "1")
    .option("-u, --universe <name>", "Universe name")
    .option("-o, --observer <name>", "Observer name")
    .accountOptions()
    .action(async (files, options) => {
      const materials = [];

      // Process each file argument
      for (const file of files) {
        const [filePath, hasher_, contentType_] = file.split(":");
        const hasher = hasher_ ? Number(hasher_) : Number(options.hasher) || 1;
        const contentType = contentType_ || options.contentType || guessContentType(filePath);
        materials.push({ filePath, hasher, contentType });
      }

      const conf: Observer = getObserverConfig(options);
      const keystore = await keystoreFromOptions(options);
      const pair = await keystore.pair();

      // Connect to the Substrate node
      // console.log(`Connecting to ${conf.rpc}...`);
      const provider = new WsProvider(conf.rpc);
      const api = await ApiPromise.create({ provider });
      await api.isReady;
      // console.log("Connected to Substrate node");

      const txns = [];

      // Submit transactions for each material
      for (const { filePath, hasher, contentType } of materials) {
        console.log(`Processing ${filePath}: content-type=${contentType}, hasher=${hasher}`);

        const content = fs.readFileSync(filePath);
        const contentRaw = api.createType("Raw", content, content.length);
        const call = api.tx.every.matterRegister(hasher, contentType, contentRaw);

        console.log(`Submitting transaction for ${filePath}...`);
        const txn = await submitTransaction(api, call, pair);
        console.log(`Transaction submitted: ${txn.txHash}`);

        txns.push({ txn, filePath });
      }

      // Wait for all transactions to be finalized
      for (const { txn, filePath } of txns) {
        console.log(`Waiting for ${filePath} to be finalized...`);
        const receipt = await txn.receipt;

        const event = findEvent(receipt.events, "MaterialAdded");
        if (event) {
          const hash = event.data[0].toString();
          console.log(`${filePath} finalized in block ${receipt.blockHash}`);
          console.log(`  Matter hash: ${hash}`);

          if (conf.gateway) {
            console.log(`  Preimage: ${conf.gateway}/m/${hash}`);
          }

          if (conf.explorer) {
            // console.log(`  Transaction: ${conf.explorer}/extrinsic/${receipt.blockNumber}-${receipt.txIndex}`);
          }
        } else {
          console.log(`${filePath} finalized, but no MaterialAdded event found`);
          for (const { event } of receipt.events) {
            console.log(`${event.method.padEnd(20)}`, JSON5.stringify(event.data.toHuman()));
          }
        }
      }

      await api.disconnect();
      console.log("Disconnected from Substrate node");
    });

  return cmd;
}
