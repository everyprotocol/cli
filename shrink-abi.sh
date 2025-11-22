#!/usr/bin/env bash

set -euo pipefail

CORE_DIR=${CORE_DIR:-../core}
PERIPHERY_DIR=${PERIPHERY_DIR:-../periphery}

ABI_DIR=${ABI_DIR:-abis2}
mkdir -p "$ABI_DIR"

# --- Build core and periphery ---

(
  cd "$CORE_DIR"
  forge build
)

(
  cd "$PERIPHERY_DIR"
  forge build
)

# --- Aggregate all events + errors into a merged ABI ---

# Search core/out and periphery/out for json files, excluding Std, Vm, and test artifacts.
find "$CORE_DIR/out" "$PERIPHERY_DIR/out" -maxdepth 2 -name '*.json' |
  grep -v -E '/Std.*\.sol/|/Vm.*\.sol/|/.*\.t\.sol/' |
  xargs -r -I{} jq -c '.abi // []' '{}' |
  jq -s 'add | unique_by(.name + "-" + .type)
            | map(select(.type == "event" or .type == "error"))' \
    >"$ABI_DIR/events-errors.json"

# --- Shrink specific core ABIs (abi + metadata only) ---

for name in ISetRegistry IOmniRegistry IKindRegistry IElementRegistry ISet; do
  src="$CORE_DIR/out/$name.sol/$name.json"
  jq '{abi: .abi, metadata: .metadata}' -c "$src" >"$ABI_DIR/$name.json"
done

# --- Shrink specific periphery ABIs (abi + metadata only) ---

for name in ObjectMinterAdmin SetRegistryAdmin; do
  src="$PERIPHERY_DIR/out/$name.sol/$name.json"
  jq '{abi: .abi, metadata: .metadata}' -c "$src" >"$ABI_DIR/$name.json"
done
