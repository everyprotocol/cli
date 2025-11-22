import path from "node:path";

/**
 * Load a Foundry artifact path info by ID.
 * ID forms supported:
 *   - "File.sol"
 *   - "File.sol:Contract"
 *   - "path/to/File.sol:Contract"
 * Default artifactDir is "out".
 *
 * Returns: { contract: "Contract", file: "out/File.sol/Contract.json" }
 */
export function getArtifactPath(id: string, artifactDir = "out"): { contract: string; file: string } {
  // split on LAST ":" so paths containing ":" still work
  const c = id.lastIndexOf(":");
  let contract = c === -1 ? "" : id.slice(c + 1);
  const filePart = c === -1 ? id : id.slice(0, c);
  const fileBase = path.basename(filePart);
  if (!fileBase.toLowerCase().endsWith(".sol")) {
    throw new Error(`"${filePart}" is not a .sol file`);
  }
  // infer contract name if omitted -> File.sol => File
  if (!contract) contract = fileBase.slice(0, -".sol".length);
  const file = path.join(artifactDir, fileBase, `${contract}.json`);
  return { contract, file };
}

/** Get creation (deploy) bytecode from a Foundry/solc artifact JSON object. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCreationCode(artifact: any): `0x${string}` {
  // Foundry may store as string or { object: string }
  const bc = typeof artifact?.bytecode === "string" ? artifact.bytecode : artifact?.bytecode?.object;
  if (typeof bc !== "string") {
    throw new Error("bytecode missing or not a string");
  }
  // Check for unlinked library placeholders like __$abcd...$__
  if (bc.includes("__$")) {
    const matches = [...bc.matchAll(/__\$([0-9a-fA-F]{34})\$__/g)];
    const labels = [...new Set(matches.map((m) => m[0]))];
    throw new Error(`Unlinked: ${labels.join(", ")}`);
  }

  if (!/^0x[0-9a-fA-F]*$/.test(bc)) {
    throw new Error("bytecode not valid hex (expected 0x-prefixed hex string)");
  }

  return bc as `0x${string}`;
}

/** Get ABI array from a Foundry/solc artifact JSON object. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAbiFromArtifact(artifact: any): any[] {
  const abi = artifact?.abi;
  if (!Array.isArray(abi)) throw new Error("abi missing or not an array");
  return abi;
}
