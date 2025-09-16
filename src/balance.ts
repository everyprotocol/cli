import { Command } from "commander";
import "@polkadot/api-augment/substrate";
import { FrameSystemAccountInfo } from "@polkadot/types/lookup";
import * as JSON11 from "json11";
import columify from "columnify";
import { getSubstrateApi, keystoreFromOptions } from "./utils.js";
import { submitTransaction } from "./substrate.js";
import { optNetwork } from "./options.js";
import { u8aFixLength } from "@polkadot/util";
import { decodeAddress } from "@polkadot/util-crypto";

const queryCmd = new Command("query")
  .description("Query account balance")
  .argument("<address>", "Account address (SS58 or 0x hex)")
  .addOption(optNetwork)
  .action(async (address, options) => {
    const api = await getSubstrateApi(options);
    const accountId = u8aFixLength(decodeAddress(address), 256);
    const accountInfo = (await api.query.system.account(accountId)) as FrameSystemAccountInfo;
    const symbol = api.registry.chainTokens[0];

    const free = accountInfo.data.free.toBigInt();
    const reserved = accountInfo.data.reserved.toBigInt();
    const frozen = accountInfo.data.frozen.toBigInt();
    const balance = { free, reserved, frozen };

    console.log(columify([[symbol, JSON11.stringify(balance)]], { showHeaders: false }));
    api.disconnect();
  });

const transferCmd = new Command("transfer")
  .description("Transfer balance to account")
  .argument("<address>", "Recipient account address (SS58 or 0x hex)")
  .argument("<amount>", "Amount in base units")
  .accountOptions()
  .addOption(optNetwork)
  .action(async (address, amount, options) => {
    const api = await getSubstrateApi(options);
    const keystore = await keystoreFromOptions(options);
    const pair = await keystore.pair();

    const call = api.tx.balances.transferKeepAlive(address, amount);

    console.log(`Transaction submitting...`);
    const txn = await submitTransaction(api, call, pair);
    console.log(`Transaction submitted: ${txn.txHash}`);
    console.log(`Transaction confirming...`);
    const r = await txn.receipt;

    const header = await api.rpc.chain.getHeader(r.blockHash);
    console.log(`Transaction confirmed: ${txn.txHash} block=${header.number}`);
    const result = r.events.map((e) => [e.event.method, JSON11.stringify(e.event.data.toJSON())]);
    console.log(columify(result, { showHeaders: false }));

    api.disconnect();
  });

export const balanceCmd = new Command("balance")
  .description("manage balances")
  .addCommand(queryCmd)
  .addCommand(transferCmd);
