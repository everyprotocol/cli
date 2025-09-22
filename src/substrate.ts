import "@polkadot/api-augment/substrate";
import { decodeAddress } from "@polkadot/util-crypto";
import { u8aFixLength } from "@polkadot/util";
import type { EventRecord } from "@polkadot/types/interfaces";
import { KeyringPair } from "@polkadot/keyring/types";
import { ApiPromise } from "@polkadot/api";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { ISubmittableResult } from "@polkadot/types/types";
import * as JSON11 from "json11";
import columify from "columnify";
import { createDeferred } from "./utils.js";
import "./commander-patch.js";
import { Logger } from "./logger.js";

interface Receipt {
  txHash: string;
  blockHash: string;
  events: EventRecord[];
  result: ISubmittableResult;
}

interface Transaction {
  txHash: string;
  receipt: Promise<Receipt>;
}

export async function submitTransaction(
  api: ApiPromise,
  tx: SubmittableExtrinsic<"promise">,
  pair: KeyringPair
): Promise<Transaction> {
  const pTxn = createDeferred<Transaction>();
  const pReceipt = createDeferred<Receipt>();
  const accountId = u8aFixLength(decodeAddress(pair.address), 256);
  const nonce = await api.rpc.system.accountNextIndex(accountId);

  const unsub = await tx.signAndSend(pair, { nonce }, (result) => {
    const { status, txHash, events, dispatchError } = result;

    if (dispatchError) {
      if (dispatchError.isModule) {
        const meta = api.registry.findMetaError(dispatchError.asModule);
        const msg = `${meta.section}.${meta.name}${meta.docs.length ? `: ${meta.docs.join(" ")}` : ""}`;
        unsub();
        pReceipt.reject(new Error(`DispatchError: ${msg}`));
      } else {
        unsub();
        pReceipt.reject(new Error(dispatchError.toString()));
      }
    }

    if (status.isReady) {
      pTxn.resolve({ txHash: txHash.toHex(), receipt: pReceipt.promise });
    }

    if (status.isFinalized) {
      unsub();
      pReceipt.resolve({
        txHash: txHash.toHex(),
        blockHash: status.asFinalized.toHex(),
        events: events,
        result,
      });
    }
  });

  return await pTxn.promise;
}

export async function submitSubTxUI(
  api: ApiPromise,
  tx: SubmittableExtrinsic<"promise">,
  pair: KeyringPair,
  console: Logger
) {
  console.log(`Transaction submitting...`);
  const txn = await submitTransaction(api, tx, pair);
  console.log(`Transaction submitted: ${txn.txHash}`);
  console.log("Waiting for confirmation...");
  const r = await txn.receipt;
  const header = await api.rpc.chain.getHeader(r.blockHash);
  console.log(`Confirmed in: block ${header.number}, hash ${header.hash}`);
  const events = r.events.map((e, i) => [i, e.event.method, JSON11.stringify(e.event.data.toJSON())]);
  const result = r.events.map((e) => {
    const event = {
      event: e.event.method,
      data: e.event.data.toJSON(),
    };
    return event;
  });
  if (events.length > 0) {
    console.log(`Events`);
    console.log(columify(events, { showHeaders: false }));
  }
  console.result(result);
}
