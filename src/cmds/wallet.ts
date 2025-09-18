import { Command } from "commander";
import { Keyring } from "@polkadot/keyring";
import { mnemonicGenerate, cryptoWaitReady } from "@polkadot/util-crypto";
import { bytesToHex } from "viem";
import * as fs from "fs";
import { getPasswordConfirm, keystoreFromAccount, resolveKeystoreDir, saveKeystore } from "../utils.js";

const walletListCmd = new Command()
  .name("list")
  .description("List all wallets")
  .option("-f, --foundry", "use foundry keystore directory (~/.foundry/keystores)")
  .option("--dir <dir>", "specify a custom keystore directory")
  .action(async (options) => {
    const dir = resolveKeystoreDir(options);
    const files = fs.readdirSync(dir);
    files.forEach((file) => console.log(file));
  });

const walletNewCmd = new Command()
  .name("new")
  .description("Generate a new wallet")
  .option("-t, --type <type>", "key type (sr25519, ed25519, ethereum)", "sr25519")
  .option("-p, --password <password>", "password to encrypt the keystore")
  .option("-P, --password-file <file>", "password file")
  .option("--dir <dir>", "specify keystore directory")
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

const walletImportCmd = new Command()
  .name("import")
  .description("Import a wallet from a secrete URI")
  .option("-t, --type <type>", "key type (sr25519, ed25519, ethereum)", "sr25519")
  .option("-p, --password <password>", "password to encrypt the keystore")
  .option("-P, --password-file <file>", "password file")
  .option("--dir <dir>", "specify a custom keystore directory")
  .option("-f, --foundry", "use foundry keystore directory (~/.foundry/keystores)")
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

const walletInspectCmd = new Command()
  .name("inspect")
  .description("Inspect a wallet")
  .option("-t, --type <type>", "key type (sr25519, ed25519, ethereum)", "sr25519")
  .option("-p, --password <password>", "password to decrypt the keystore")
  .option("-P, --password-file <file>", "file containing the password")
  .option("-x, --decrypt", "also decrypt the private key", false)
  .option("--dir <dir>", "specify a custom keystore directory")
  .option("-f, --foundry", "use foundry keystore directory (~/.foundry/keystores)")
  .argument("<name>", "name of the wallet")
  .action(async (name, options) => {
    const keystore = await keystoreFromAccount(name, options);
    let decoded;
    if (options.decrypt) {
      decoded = await keystore.privateKey();
    }

    let dir = "~/.every/keystores";
    if (options.foundry) {
      dir = "~/.foundry/keystores";
    } else if (options.dir) {
      dir = options.dir;
    }
    console.log(`   Keystore: ${dir}/${name}`);
    console.log(` Store Type: ${keystore.type()}`);
    console.log(`   Key Type: ${keystore.keyType()}`);
    console.log(`    Address: ${await keystore.address()}`);
    console.log(` Public Key: ${bytesToHex(await keystore.publicKey())}`);
    if (decoded) {
      console.log(`Private Key: ${bytesToHex(decoded)}`);
    }
  });

export const walletCmd = new Command()
  .name("wallet")
  .description("manage wallets")
  .addCommand(walletListCmd)
  .addCommand(walletNewCmd)
  .addCommand(walletImportCmd)
  .addCommand(walletInspectCmd);
