import { u8aFixLength } from "@polkadot/util";
import { decodeAddress } from "@polkadot/util-crypto";
import { InvalidArgumentError } from "commander";

export function parseBigInt(arg: string): bigint {
  try {
    return BigInt(arg);
  } catch (e /* eslint-disable-line */) {
    throw new InvalidArgumentError("invalid bigint");
  }
}

export function parseSID(arg: string): { set: bigint; id: bigint } {
  try {
    const [s, i] = arg.split(".");
    const set = BigInt(s);
    const id = BigInt(i);
    return { set, id };
  } catch (e /* eslint-disable-line */) {
    throw new InvalidArgumentError(`invalid SID: ${arg}`);
  }
}

export function parseAccountId(address: string) {
  try {
    return u8aFixLength(decodeAddress(address), 256);
  } catch (e /* eslint-disable-line */) {
    throw new InvalidArgumentError("invalid account ID");
  }
}

export function parseNode4(arg: string): bigint {
  const parts = arg.split(".");
  let [data, grant, set, id] = [0n, 0n, 0n, 0n];
  if (parts.length == 2) {
    set = BigInt(parts[0]);
    id = BigInt(parts[1]);
  } else if (parts.length == 3) {
    grant = BigInt(parts[0]);
    set = BigInt(parts[1]);
    id = BigInt(parts[2]);
  } else if (parts.length == 4) {
    data = BigInt(parts[0]);
    grant = BigInt(parts[1]);
    set = BigInt(parts[2]);
    id = BigInt(parts[3]);
  } else {
    throw new InvalidArgumentError("invalid Node4");
  }
  return (data << 192n) | (grant << 128n) | (set << 64n) | id;
}

export function parseNode3(arg: string): bigint {
  const parts = arg.split(".");
  let [grant, set, id] = [0n, 0n, 0n];
  if (parts.length == 2) {
    set = BigInt(parts[0]);
    id = BigInt(parts[1]);
  } else if (parts.length == 3) {
    grant = BigInt(parts[0]);
    set = BigInt(parts[1]);
    id = BigInt(parts[2]);
  } else {
    throw new InvalidArgumentError("invalid Node3");
  }
  return (grant << 128n) | (set << 64n) | id;
}
