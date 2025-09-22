import { Command } from "commander";
import "@polkadot/api-augment/substrate";
import { FrameSystemAccountInfo } from "@polkadot/types/lookup";
import * as JSON11 from "json11";
import columify from "columnify";
import { u8aFixLength } from "@polkadot/util";
import { decodeAddress } from "@polkadot/util-crypto";
import { submitSubTxUI } from "../substrate.js";
import { network } from "../commander-patch.js";
import { Logger } from "../logger.js";

const balanceQueryCmd = new Command("query")
  .description("Query account balance")
  .argument("<address>", "Account address (SS58 or 0x hex)")
  .addOption(network)
  .addOutputOptions()
  .subReadAction(async function (api, address) {
    const accountId = u8aFixLength(decodeAddress(address), 256);
    const accountInfo = (await api.query.system.account(accountId)) as FrameSystemAccountInfo;
    const symbol = api.registry.chainTokens[0];

    const free = accountInfo.data.free.toBigInt();
    const reserved = accountInfo.data.reserved.toBigInt();
    const frozen = accountInfo.data.frozen.toBigInt();
    const balance = { free, reserved, frozen };
    const result = { address, symbol, balance };

    const console = new Logger(this.opts());
    console.log(columify([[symbol, JSON11.stringify(balance)]], { showHeaders: false }));
    console.result(result);
  });

const balanceTransferCmd = new Command("transfer")
  .description("Transfer balance to account")
  .argument("<address>", "Recipient account address (SS58 or 0x hex)")
  .argument("<amount>", "Amount in base units")
  .addOption(network)
  .addKeystoreOptions()
  .addOutputOptions()
  .subWriteAction(async function (api, pair, address, amount) {
    const tx = api.tx.balances.transferKeepAlive(address, amount);
    const console = new Logger(this.opts());
    await submitSubTxUI(api, tx, pair, console);
  });

export const balanceCmd = new Command("balance")
  .description("manage balances")
  .addCommand(balanceQueryCmd)
  .addCommand(balanceTransferCmd);
