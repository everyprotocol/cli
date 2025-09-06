import { Keyring } from "@polkadot/keyring";
import type { KeyringPair, KeyringPair$Json } from "@polkadot/keyring/types";
import { u8aToHex, hexToU8a, isHex } from "@polkadot/util";
import { base64Decode, cryptoWaitReady } from "@polkadot/util-crypto";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { Wallet } from "ethers";
import { decodePair } from "@polkadot/keyring/pair/decode";

export type KeyType = "sr25519" | "ed25519" | "ecdsa" | "ethereum";
export type StoreType = "substrate" | "web3_v3";

type SubstrateJson = {
  encoded: string;
  encoding: {
    content: string[] | string;
    type: string[] | string;
    version?: string | number;
  };
  address?: string;
  meta?: unknown;
};

type Web3V3Json = {
  version: number | string;
  crypto: unknown;
  address?: string;
  id?: string;
  [k: string]: unknown;
};

function isSubstrateJson(obj: /*eslint-disable-line @typescript-eslint/no-explicit-any*/ any): obj is SubstrateJson {
  return !!obj?.encoded && !!obj?.encoding && !!obj?.encoding?.content;
}

function isWeb3V3Json(obj: /*eslint-disable-line @typescript-eslint/no-explicit-any*/ any): obj is Web3V3Json {
  return Number(obj?.version) === 3 && !!obj?.crypto;
}

function inferSubstrateKeyType(obj: SubstrateJson): KeyType {
  const content = Array.isArray(obj.encoding.content) ? obj.encoding.content : [obj.encoding.content];
  // Typical values: ["pkcs8","sr25519"] | ["pkcs8","ed25519"] | ["pkcs8","ecdsa"] | ["pkcs8","ethereum"]
  if (content.includes("sr25519")) return "sr25519";
  if (content.includes("ed25519")) return "ed25519";
  if (content.includes("ecdsa")) return "ecdsa";
  if (content.includes("ethereum")) return "ethereum";
  // Default to sr25519 if not specified (common in older exports)
  return "sr25519";
}

function decryptSubstrate(keystore: SubstrateJson, password = ""): Uint8Array {
  const encodedRaw = keystore.encoded;
  const types = keystore.encoding.type;
  const encodingTypes = Array.isArray(types) ? types : [types];

  const encoded = isHex(encodedRaw) ? hexToU8a(encodedRaw) : base64Decode(encodedRaw);
  const decoded = decodePair(
    password,
    encoded,
    encodingTypes as any /*eslint-disable-line @typescript-eslint/no-explicit-any*/
  );
  return decoded.secretKey;
}

async function decryptWeb3V3(keystore: Web3V3Json, password = ""): Promise<Uint8Array> {
  const w = await Wallet.fromEncryptedJson(JSON.stringify(keystore), password);
  return hexToU8a(w.privateKey);
}

export class UnifiedKeystore {
  private _keystore: SubstrateJson | Web3V3Json;
  private _type: StoreType;
  private _keyType: KeyType;
  private _password?: string;

  private _pair?: KeyringPair; // cached for all key types
  private _account?: PrivateKeyAccount; // cached for ethereum keys (viem)
  private _privateKey?: Uint8Array; // cached decrypted private key

  private constructor(type: StoreType, keyType: KeyType, keystore: SubstrateJson | Web3V3Json, password?: string) {
    this._keystore = keystore;
    this._type = type;
    this._keyType = keyType;
    this._password = password;
  }

  static async fromJSON(keystore: string | object, password?: string): Promise<UnifiedKeystore> {
    await cryptoWaitReady();
    const obj = typeof keystore === "string" ? JSON.parse(keystore) : keystore;

    if (isSubstrateJson(obj)) {
      const keyType = inferSubstrateKeyType(obj);
      return new UnifiedKeystore("substrate", keyType, obj, password);
    }
    if (isWeb3V3Json(obj)) {
      return new UnifiedKeystore("web3_v3", "ethereum", obj, password);
    }
    throw new Error("Unsupported keystore JSON: expected Substrate (pkcs8) or Web3 v3 keystore");
  }

  type(): StoreType {
    return this._type;
  }

  keyType(): KeyType {
    return this._keyType;
  }

  async address(): Promise<string> {
    return (await this.pair()).address;
  }

  async publicKey(): Promise<Uint8Array> {
    return (await this.pair()).publicKey;
  }

  async privateKey(): Promise<Uint8Array> {
    if (this._privateKey) return this._privateKey;

    if (this._type === "substrate") {
      this._privateKey = decryptSubstrate(this._keystore as SubstrateJson, this._password ?? "");
    } else {
      this._privateKey = await decryptWeb3V3(this._keystore as Web3V3Json, this._password ?? "");
    }
    return this._privateKey;
  }

  async pair(): Promise<KeyringPair> {
    if (this._pair) return this._pair;

    const keyring = new Keyring({ type: this._keyType });
    if (this._type === "substrate") {
      const pair = keyring.addFromJson(this._keystore as unknown as KeyringPair$Json);
      if (this._password !== undefined) {
        try {
          pair.unlock(this._password);
        } catch {
          // If password is wrong/empty, leave it locked; address/publicKey still work.
        }
      }
      this._pair = pair;
    } else {
      const sk = await this.privateKey();
      this._pair = keyring.addFromUri(u8aToHex(sk));
    }

    return this._pair!;
  }

  async account(): Promise<PrivateKeyAccount> {
    if (this._keyType !== "ethereum") {
      throw new Error("accounts() is only available for ethereum keys");
    }
    if (this._account) return this._account;

    const sk = await this.privateKey();
    this._account = privateKeyToAccount(u8aToHex(sk));
    return this._account;
  }
}
