import { Command } from "commander";
import { Keyring } from "@polkadot/keyring";
import { mnemonicGenerate } from "@polkadot/util-crypto";
import { isHex, hexToU8a } from "@polkadot/util";
import { base64Decode } from "@polkadot/util-crypto/base64";
import { decodePair } from "@polkadot/keyring/pair/decode";
import { bytesToHex } from "viem";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";

// Helper functions
function resolveKeyStoreDir(options: any): string {
  if (options.foundry) {
    return path.join(os.homedir(), ".foundry", "keystores");
  }
  if (options.dir) {
    return options.dir;
  }
  if (options.keystore) {
    return options.keystore;
  }
  return path.join(os.homedir(), ".every", "keystores");
}

function resolveKeyStoreFile(name: string, options: any): string {
  const dir = resolveKeyStoreDir(options);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, name);
}

function readKeyStoreKey(keyFile: string): any {
  if (!fs.existsSync(keyFile)) {
    throw new Error(`Keystore file not found: ${keyFile}`);
  }
  return JSON.parse(fs.readFileSync(keyFile, "utf8"));
}

async function getPassword(opts: any): Promise<string> {
  if (opts.password) {
    return opts.password;
  }

  if (opts.passwordFile) {
    return fs.readFileSync(opts.passwordFile, "utf8").trim();
  }

  // Interactive password prompt
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Password: ", (password) => {
      rl.close();
      resolve(password);
    });
  });
}

function decryptPrivateKey(encodedRaw: string, password: string | undefined, encType: any) {
  const encoded = isHex(encodedRaw) ? hexToU8a(encodedRaw) : base64Decode(encodedRaw);
  const decoded = decodePair(password, encoded, encType);
  return decoded;
}

// Wallet commands
export function genWalletCommands() {
  const walletCmd = new Command().name("wallet").description("Manage wallets");

  // List command
  const listCmd = new Command()
    .name("list")
    .description("List all wallets in the keystore directory")
    .option("--keystore <dir>", "keystore directory")
    .option("--dir <dir>", "custom directory for keystores")
    .option("--foundry", "use foundry keystore directory (~/.foundry/keystores)")
    .action(async (options) => {
      const dir = resolveKeyStoreDir(options);
      if (!fs.existsSync(dir)) {
        console.log(`Keystore directory does not exist: ${dir}`);
        return;
      }
      const files = fs.readdirSync(dir);
      files.forEach((file) => {
        console.log(file);
      });
    });

  // Generate command
  const generateCmd = new Command()
    .name("generate")
    .description("Generate a new wallet")
    .option("--keystore <dir>", "keystore directory")
    .option("--dir <dir>", "custom directory for keystores")
    .option("--foundry", "use foundry keystore directory (~/.foundry/keystores)")
    .option("--type <type>", "key type (ed25519, sr25519, ethereum)", "sr25519")
    .option("-p, --password <password>", "password to encrypt the keystore")
    .option("--password-file <file>", "file containing the password")
    .argument("<name>", "name of the wallet")
    .action(async (name, options) => {
      const file = resolveKeyStoreFile(name, options);
      if (fs.existsSync(file)) {
        console.error(`Keystore file exists: ${file}`);
        return;
      }

      const password = await getPassword(options);
      const keyring = new Keyring();
      const mnemonic = mnemonicGenerate();
      const pair = keyring.addFromUri(mnemonic, { name }, options.type);
      const json = pair.toJson(password);

      fs.writeFileSync(file, JSON.stringify(json));
      console.log(`Wallet ${name} saved to ${file}`);
      console.log(`Mnemonic: ${mnemonic}`);
    });

  // Import command
  const importCmd = new Command()
    .name("import")
    .description("Import a wallet")
    .option("--keystore <dir>", "keystore directory")
    .option("--dir <dir>", "custom directory for keystores")
    .option("--foundry", "use foundry keystore directory (~/.foundry/keystores)")
    .option("--type <type>", "key type (ed25519, sr25519, ethereum)", "sr25519")
    .option("-p, --password <password>", "password to encrypt the keystore")
    .option("--password-file <file>", "file containing the password")
    .argument("<name>", "name of the wallet")
    .argument("<suri>", "secret URI for the wallet")
    .action(async (name, suri, options) => {
      const file = resolveKeyStoreFile(name, options);
      if (fs.existsSync(file)) {
        console.error(`Keystore file exists: ${file}`);
        return;
      }

      const password = await getPassword(options);
      const keyring = new Keyring({ type: options.type });
      const pair = keyring.addFromUri(suri);
      const json = pair.toJson(password);

      fs.writeFileSync(file, JSON.stringify(json));
      console.log(`Wallet ${name} saved to ${file}`);
    });

  // Inspect command
  const inspectCmd = new Command()
    .name("inspect")
    .description("Inspect a wallet")
    .option("--keystore <dir>", "keystore directory")
    .option("--dir <dir>", "custom directory for keystores")
    .option("--foundry", "use foundry keystore directory (~/.foundry/keystores)")
    .option("--type <type>", "key type (sr25519, ed25519, ethereum)", "sr25519")
    .option("-p, --password <password>", "password to decrypt the keystore")
    .option("--password-file <file>", "file containing the password")
    .option("-x, --decrypt", "also decrypt the private key", false)
    .argument("<name>", "name of the wallet")
    .action(async (name, options) => {
      const keyFile = resolveKeyStoreFile(name, options);
      const keyData = readKeyStoreKey(keyFile);
      const keyring = new Keyring({ type: options.type });
      const account = keyring.addFromJson(keyData);

      let password;
      if (account.isLocked) {
        password = await getPassword(options);
        account.unlock(password);
      }

      let decoded;
      if (options.decrypt) {
        const type = keyData.encoding.type;
        const encType = !Array.isArray(type) ? [type] : type;
        decoded = decryptPrivateKey(keyData.encoded, password, encType);
      }

      let keystoreDisplay = "~/.every/keystores";
      if (options.foundry) {
        keystoreDisplay = "~/.foundry/keystores";
      } else if (options.dir) {
        keystoreDisplay = options.dir;
      } else if (options.keystore) {
        keystoreDisplay = options.keystore;
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
