#!/bin/bash
set -e

CONTRACTS_OUT_DIR=${CONTRACTS_DIR:-"../core/out"}

for abi in SetRegistry OmniRegistry KindRegistry ElementRegistry ObjectMinter; do
    file="$CONTRACTS_OUT_DIR/${abi}.sol/${abi}.json"
    cp "$file" abis/
    echo $file
done

for abi in ISetRegistry IOmniRegistry IKindRegistry IElementRegistry IObjectMinter ISet ISetRegistryAdmin IObjectMinterAdmin; do
    file="$CONTRACTS_OUT_DIR/${abi}.sol/${abi}.json"
    cp "$file" abis/
    echo $file
done
