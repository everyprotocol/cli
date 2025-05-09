import { Address, SolidityTuple } from "abitype/zod";
import { AbiParameterToPrimitiveType, AbiTypeToPrimitiveType, parseAbi } from "abitype";
// const encodedData = encodeAbiParameters(
//   [
//     { name: "x", type: "string" },
//     { name: "y", type: "uint" },
//     { name: "z", type: "bool" },
//   ],
//   ["wagmi", "420", "true"]
// );

// parseAbi(signatures);
//
// string, address, uint32, uint64, uint64[], uint8[],
// ai! write a function to load all distinct types (native solidity types and user defined types)
