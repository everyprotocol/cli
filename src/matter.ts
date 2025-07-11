import { Command } from "commander";
import { ApiPromise, WsProvider } from "@polkadot/api";
import "@polkadot/api-augment/substrate";
import * as fs from "fs";
import * as path from "path";
import { getUniverseConfig } from "./config.js";
import { getSubstrateAccountPair } from "./utils.js";
import { decodeAddress } from "@polkadot/util-crypto";
import { u8aFixLength } from "@polkadot/util";

interface Receipt {
  txHash: string;
  blockHash: string;
  events: any[];
  txIndex: number;
  blockNumber: number;
}

interface Transaction {
  txHash: string;
  receipt: Promise<Receipt>;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function submitTransaction(api: any, tx: any, pair: any): Promise<Transaction> {
  // const pTxn = Promise.withResolvers<Transaction>();
  // const pReceipt = Promise.withResolvers<Receipt>();
  const pTxn = createDeferred<Transaction>();
  const pReceipt = createDeferred<Receipt>();
  const accountId = u8aFixLength(decodeAddress(pair.address), 256);
  const nonce = await api.rpc.system.accountNextIndex(accountId);

  const unsub = await tx.signAndSend(pair, { nonce }, ({ events = [], status, txHash, txIndex, blockNumber }: any) => {
    if (status.isReady) {
      pTxn.resolve({ txHash: txHash.toHex(), receipt: pReceipt.promise });
    } else if (status.isFinalized) {
      pReceipt.resolve({
        txHash: txHash.toHex(),
        blockHash: status.asFinalized.toHex(),
        txIndex,
        blockNumber,
        events: events,
      });
      unsub();
    }
  });

  return await pTxn.promise;
}

function findEvent(events: any[], name: string): any {
  for (const record of events) {
    if (record.event && record.event.method === name) {
      return record.event;
    }
  }
  return null;
}

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
  const cmd = new Command().name("matter").description("Manage matters");

  cmd
    .command("register")
    .description("Register matter on the Substrate chain")
    .argument("<files...>", "Path to the file(s) containing the matter content")
    .option("-c, --content-type <type>", "Default content type")
    .option("-h, --hasher <number>", "Default hasher", "1")
    .option("-u, --universe <universe>", "Universe name", "local")
    .option("-a, --account <account>", "Name of the keystore to sign the transaction")
    .option("-p, --password [password]", "Password to decrypt the keystore")
    .option("--password-file <file>", "File containing the password to decrypt the keystore")
    .action(async (files, options) => {
      const materials = [];

      // Process each file argument
      for (const file of files) {
        let [filePath, hasher_, contentType] = file.split(":");
        const hasher = hasher_ ? Number(hasher_) : Number(options.hasher) || 1;

        if (!contentType) {
          if (options.contentType) {
            contentType = options.contentType;
          } else {
            contentType = guessContentType(filePath);
          }
        }

        materials.push({ filePath, hasher, contentType });
      }

      // Get universe configuration
      const conf = getUniverseConfig(options);
      if (!conf.observer.rpc) {
        throw new Error("pre_rpc_url not configured in universe");
      }

      // Get account pair for signing
      if (!options.account) {
        throw new Error("Account must be specified with --account");
      }

      // const keystorePath = resolveKeystoreFile(options.account, options);
      // const keystore = loadKeystore(keystorePath);
      // const password = getPassword(options);
      const accountPair = getSubstrateAccountPair(options);

      // Connect to the Substrate node
      console.log(`Connecting to ${conf.observer.rpc}...`);
      const provider = new WsProvider(conf.observer.rpc);
      const api = await ApiPromise.create({ provider });
      await api.isReady;
      console.log("Connected to Substrate node");

      const txns = [];

      // Submit transactions for each material
      for (const { filePath, hasher, contentType } of materials) {
        console.log(`Processing ${filePath}: content-type=${contentType}, hasher=${hasher}`);

        const content = fs.readFileSync(filePath);
        const contentRaw = api.createType("Raw", content, content.length);
        const call = api.tx.matter.register(hasher, contentType, contentRaw);

        console.log(`Submitting transaction for ${filePath}...`);
        const txn = await submitTransaction(api, call, accountPair);
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

          if (conf.observer.gateway) {
            console.log(`  Preimage: ${conf.observer.gateway}/m/${hash}`);
          }

          if (conf.observer.explorer) {
            console.log(`  Transaction: ${conf.observer.explorer}/extrinsic/${receipt.blockNumber}-${receipt.txIndex}`);
          }
        } else {
          console.log(`${filePath} finalized, but no MaterialAdded event found`);
        }
      }

      await api.disconnect();
      console.log("Disconnected from Substrate node");
    });

  return cmd;
}
