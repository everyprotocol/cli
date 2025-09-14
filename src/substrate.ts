import "@polkadot/api-augment/substrate";
import { decodeAddress } from "@polkadot/util-crypto";
import { u8aFixLength } from "@polkadot/util";
import type { Event, EventRecord } from "@polkadot/types/interfaces";
import { KeyringPair } from "@polkadot/keyring/types";
import type { ApiPromise } from "@polkadot/api";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { ISubmittableResult } from "@polkadot/types/types";

import "./options.js";

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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: object) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export async function submitTransaction(
  api: ApiPromise,
  tx: SubmittableExtrinsic<"promise">,
  pair: KeyringPair
): Promise<Transaction> {
  // const pTxn = Promise.withResolvers<Transaction>();
  // const pReceipt = Promise.withResolvers<Receipt>();
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

export function findEvent(events: EventRecord[], name: string): Event | undefined {
  for (const record of events) {
    if (record.event && record.event.method === name) {
      return record.event;
    }
  }
  return undefined;
}
