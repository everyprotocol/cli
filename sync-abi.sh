#!/bin/bash
# Script to sync ABI files from the core project

# Set the directory where contract output files are located
CONTRACTS_OUT_DIR="../core/out"

# Check if the directory exists
if [ ! -d "$CONTRACTS_OUT_DIR" ]; then
    echo "Error: Contract output directory not found: $CONTRACTS_OUT_DIR"
    exit 1
fi

# Check if the abis directory exists, create it if not
if [ ! -d "abis" ]; then
    echo "Creating abis directory..."
    mkdir -p abis
fi

# Copy ABI files for each contract
for abi in SetRegistry OmniRegistry KindRegistry ElementRegistry ObjectMinter; do
    source_file="$CONTRACTS_OUT_DIR/${abi}.sol/${abi}.json"
    
    if [ -f "$source_file" ]; then
        echo "Copying $abi ABI..."
        cp "$source_file" abis/
    else
        echo "Warning: ABI file not found: $source_file"
    fi
done

echo "ABI sync complete!"
