export enum RelationTerminator {
  TailOwner = 0,
  HeadOwner = 1,
  Either = 2,
  Neither = 3,
  Anyone = 4,
  Nobody = 5,
}

export enum RelationOwnerShift {
  Retain = 0,
  TransferToTailOwner = 1,
  TransferToHeadOwner = 2,
  TransferToCaller = 3,
  TransferToPreset = 4,
  TransferToBurned = 5,
  TransferToResolved = 6,
  TransferToIntended = 7,
  HoldForTailOwner = 8,
  HoldForHeadOwner = 9,
  HoldForCaller = 10,
  HoldForPreset = 11,
  HoldForBurned = 12,
  HoldForResolved = 13,
  HoldPending = 14,
}

export function parseEnum<T extends object>(v: unknown, E: T, name: string): number {
  if (typeof v === "number") {
    if (v in E) return v;
  } else if (typeof v === "string") {
    // accept exact key or case-insensitive key
    const k = Object.keys(E).find((key) => key.toLowerCase() === v.toLowerCase());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (k && typeof (E as any)[k] === "number") return (E as any)[k] as number;
  }
  throw new Error(`${name} must be a valid enum value or key`);
}
