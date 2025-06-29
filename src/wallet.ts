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
function resolveKeystoreDir(options: any): string {
  if (options.foundry) {
    return path.join(os.homedir(), ".foundry", "keystores");
  }
  if (options.dir) {
    return options.dir;
  }
  return path.join(os.homedir(), ".every", "keystores");
}

function resolveKeystoreFile(name: string, options: any): string {
  const dir = resolveKeystoreDir(options);
  return path.join(dir, name);
}

function saveKeystore(json: any, name: string, options: any) {
  const dir = resolveKeystoreDir(options);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const file = path.join(dir, name);
  if (fs.existsSync(file)) {
    throw new Error(`File exists: ${file}`);
  }
  fs.writeFileSync(file, JSON.stringify(json));
  console.log(`File saved: ${file}`);
}

function loadKeystore(file: string): any {
  if (!fs.existsSync(file)) {
    throw new Error(`Keystore file not found: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function getPassword(options: any): Promise<string> {
  if (options.password) {
    return options.password;
  }
  
  if (options.passwordFile) {
    return fs.readFileSync(options.passwordFile, "utf8").trim();
  }
  
  // Use a custom implementation to hide password input
  process.stdout.write("Password: ");
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    
    let password = "";
    stdin.on("data", (key: Buffer) => {
      const char = key.toString();
      
      // Ctrl+C or Ctrl+D
      if (char === "\u0003" || char === "\u0004") {
        process.exit(1);
      }
      
      // Enter key
      if (char === "\r" || char === "\n") {
        process.stdout.write("\n");
        stdin.setRawMode(false);
        stdin.pause();
        resolve(password);
        return;
      }
      
      // Backspace
      if (char === "\u007f") {
        if (password.length > 0) {
          password = password.slice(0, -1);
        }
        return;
      }
      
      // Add character to password
      password += char;
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
  const walletCmd = new Command().name("wallet").description("manage wallets");

  // List command
  const listCmd = new Command()
    .name("list")
    .description("List all wallets")
    .option("--foundry", "use foundry keystore directory (~/.foundry/keystores)")
    .option("--dir <dir>", "specify a custom keystore directory")
    .action(async (options) => {
      const dir = resolveKeystoreDir(options);
      if (!fs.existsSync(dir)) {
        console.error(`Directory not exist: ${dir}`);
        process.exit(1);
      }
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
      const password = await getPassword(options);
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
      const password = await getPassword(options);
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
