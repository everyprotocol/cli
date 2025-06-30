import { Command } from "commander";
import { Keyring } from "@polkadot/keyring";
import { mnemonicGenerate, cryptoWaitReady } from "@polkadot/util-crypto";
import { bytesToHex } from "viem";
import * as fs from "fs";
import {
  decodeSubstratePair,
  getPassword,
  getPasswordConfirm,
  loadKeystore,
  resolveKeystoreDir,
  resolveKeystoreFile,
  saveKeystore,
} from "./utils.js";

// Wallet commands
export function genWalletCommands() {
  const walletCmd = new Command().name("wallet").description("manage wallets");

  // List command
  const listCmd = new Command()
    .name("list")
    .description("List all wallets")
    .option("--foundry", "use foundry keystore directory (~/.foundry/keystores)")
    .option("--dir <dir>", "specify a custom keystore directory")
    .action(async (options) => {
      const dir = resolveKeystoreDir(options);
      const files = fs.readdirSync(dir);
      files.forEach((file) => console.log(file));
    });

  // Generate command
  const generateCmd = new Command()
    .name("new")
    .description("Generate a new wallet")
    .option("-t, --type <type>", "key type (ed25519, sr25519, ethereum)", "sr25519")
    .option("-p, --password <password>", "password to encrypt the keystore")
    .option("-P, --password-file <file>", "password file")
    .option("--dir <dir>", "specify keystore directory")
    .option("--foundry", "use foundry keystore directory (~/.foundry/keystores)")
    .argument("<name>", "name of the wallet")
    .action(async (name, options) => {
      const password = getPasswordConfirm(options);
      await cryptoWaitReady();
      const keyring = new Keyring();
      const mnemonic = mnemonicGenerate();
      const pair = keyring.addFromUri(mnemonic, { name }, options.type);
      const json = pair.toJson(password);
      saveKeystore(json, name, options);
    });

  // Import command
  const importCmd = new Command()
    .name("import")
    .description("Import a wallet from a secrete URI")
    .option("-t, --type <type>", "key type (sr25519, ed25519, ethereum)", "sr25519")
    .option("-p, --password <password>", "password to encrypt the keystore")
    .option("-P, --password-file <file>", "password file")
    .option("--dir <dir>", "specify a custom keystore directory")
    .option("--foundry", "use foundry keystore directory (~/.foundry/keystores)")
    .argument("<name>", "name of the wallet")
    .argument("<suri>", "secret URI")
    .action(async (name, suri, options) => {
      const password = getPasswordConfirm(options);
      await cryptoWaitReady();
      const keyring = new Keyring({ type: options.type });
      const pair = keyring.addFromUri(suri);
      const json = pair.toJson(password);
      saveKeystore(json, name, options);
    });

  // Inspect command
  const inspectCmd = new Command()
    .name("inspect")
    .description("Inspect a wallet")
    .option("-t, --type <type>", "key type (sr25519, ed25519, ethereum)", "sr25519")
    .option("-p, --password <password>", "password to decrypt the keystore")
    .option("-P, --password-file <file>", "file containing the password")
    .option("-x, --decrypt", "also decrypt the private key", false)
    .option("--dir <dir>", "specify a custom keystore directory")
    .option("--foundry", "use foundry keystore directory (~/.foundry/keystores)")
    .argument("<name>", "name of the wallet")
    .action(async (name, options) => {
      const file = resolveKeystoreFile(name, options);
      const keyData = loadKeystore(file);
      await cryptoWaitReady();
      const keyring = new Keyring({ type: options.type });
      const account = keyring.addFromJson(keyData);

      let password;
      if (account.isLocked) {
        password = getPassword(options);
        account.unlock(password);
      }

      let decoded;
      if (options.decrypt) {
        decoded = decodeSubstratePair(keyData, password);
      }

      let keystoreDisplay = "~/.every/keystores";
      if (options.foundry) {
        keystoreDisplay = "~/.foundry/keystores";
      } else if (options.dir) {
        keystoreDisplay = options.dir;
      }
      console.log(`  Keystore: ${keystoreDisplay}`);
      console.log(`    Wallet: ${name}`);
      console.log(`      Type: ${account.type}`);
      console.log(`      Meta: ${JSON.stringify(account.meta)}`);
      console.log(`   Address: ${account.address}`);
      console.log(`AddressRaw: ${bytesToHex(account.addressRaw)}`);
      console.log(` PublicKey: ${bytesToHex(account.publicKey)}`);

      if (decoded) {
        console.log(`SecretKey: ${bytesToHex(decoded.secretKey)}`);
      }
    });

  walletCmd.addCommand(listCmd);
  walletCmd.addCommand(generateCmd);
  walletCmd.addCommand(importCmd);
  walletCmd.addCommand(inspectCmd);

  return walletCmd;
}
