import { u8aFixLength } from "@polkadot/util";
import { decodeAddress } from "@polkadot/util-crypto";
import { InvalidArgumentError } from "commander";
import { getAddress, hexToBytes, isHex, parseUnits } from "viem";

export function parseBigInt(arg: string): bigint {
  try {
    return BigInt(arg);
  } catch (e /* eslint-disable-line */) {
    throw new InvalidArgumentError("Invalid bigint");
  }
}

export function parseInt(arg: string) {
  try {
    return Number.parseInt(arg);
  } catch (e /* eslint-disable-line */) {
    throw new InvalidArgumentError("Invalid integer");
  }
}

export function parseSID(arg: string): { set: bigint; id: bigint } {
  try {
    const [s, i] = arg.split(".");
    const set = BigInt(s);
    const id = BigInt(i);
    return { set, id };
  } catch (e /* eslint-disable-line */) {
    throw new InvalidArgumentError(`Invalid SID: ${arg}`);
  }
}

export function parseEther(arg: string): bigint {
  try {
    return parseUnits(arg, 18);
  } catch (e /* eslint-disable-line */) {
    throw new InvalidArgumentError(`Invalid ether amount: ${arg}`);
  }
}

export function parseAccountId(arg: string) {
  try {
    return u8aFixLength(decodeAddress(arg), 256);
  } catch (e /* eslint-disable-line */) {
    throw new InvalidArgumentError("Invalid account ID");
  }
}

export function parseAddress(arg: string) {
  try {
    return getAddress(arg);
  } catch (e /* eslint-disable-line */) {
    throw new InvalidArgumentError("Invalid address");
  }
}

export function parseBytes32(arg: string) {
  if (isHex(arg, { strict: true }) && hexToBytes(arg).length == 32) {
    return arg as `0x${string}`;
  }
  throw new InvalidArgumentError("Invalid bytes32");
}

export function parseHexData(arg: string) {
  if (isHex(arg, { strict: true })) {
    return arg as `0x${string}`;
  }
  throw new InvalidArgumentError("Invalid hex data");
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
