# ai! check this script
CONTRACTS_OUT_DIR={-:../core/out}
for abi in SetRegistry OmniRegistry KindRegistry ElementRegistry ObjectMinter; do
    cp $CONTRACTS_OUT_DIR/${abi}.sol/${abi}.json abis/
done
