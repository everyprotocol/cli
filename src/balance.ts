import { Command } from "commander";
import "@polkadot/api-augment/substrate";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { FrameSystemAccountInfo } from "@polkadot/types/lookup";
import * as JSON11 from "json11";
import columify from "columnify";
import { Observer } from "./config.js";
import { getObserverConfig, keystoreFromOptions } from "./utils.js";
import { submitTransaction } from "./substrate.js";
import { optNetwork } from "./options.js";

const queryCmd = new Command("query")
  .description("Query account balance")
  .argument("<address>", "Account address (SS58 or 0x hex)")
  .addOption(optNetwork)
  .action(async (address, options) => {
    const conf: Observer = getObserverConfig(options);
    const provider = new WsProvider(conf.rpc);
    const api = await ApiPromise.create({ provider });

    const accountInfo = (await api.query.system.account(address)) as FrameSystemAccountInfo;
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
    const conf: Observer = getObserverConfig(options);
    const keystore = await keystoreFromOptions(options);
    const pair = await keystore.pair();
    const provider = new WsProvider(conf.rpc);
    const api = await ApiPromise.create({ provider });

    const call = api.tx.balances.transferKeepAlive(address, amount);

    console.log(`Transaction Submitting ...`);
    const txn = await submitTransaction(api, call, pair);
    console.log(`Transaction submitted: ${txn.txHash}`);
    console.log(`Transaction confirming ...`);
    const r = await txn.receipt;

    const header = await api.rpc.chain.getHeader(r.blockHash);
    const block = { block: header.number, hash: r.blockHash };
    console.log(`Transaction confirmed: ${JSON11.stringify(block)}`);
    const result = r.events.map((e) => [e.event.method, JSON11.stringify(e.event.data.toJSON())]);
    console.log(columify(result, { showHeaders: false }));

    api.disconnect();
  });

export const balanceCmd = new Command("balance")
  .description("Manage balances")
  .addCommand(queryCmd)
  .addCommand(transferCmd);
