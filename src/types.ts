// ai! the following are the main function abi, function metadata userdoc/ devdoc, let's redefine the ContractFunctionDetail to be based on the main function abi, with only one added field named "_metadata", and merge userdoc and devdoc to be under this field
// cat abis/IKindRegistry.json| jq '.abi[2]'
// {
//   "type": "function",
//   "name": "kindOwner",
//   "inputs": [
//     {
//       "name": "id",
//       "type": "uint64",
//       "internalType": "uint64"
//     }
//   ],
//   "outputs": [
//     {
//       "name": "owner",
//       "type": "address",
//       "internalType": "address"
//     }
//   ],
//   "stateMutability": "view"
// }
//  cat abis/IKindRegistry.json| jq .metadata.output.devdoc
// {
//  "kind": "dev",
//  "methods": {
//    "kindAdmit(uint64,uint32,uint64)": {
//      "params": {
//        "kind": "Kind ID",
//        "rel": "Relation ID to check",
//        "rev": "Kind revision (0 = latest)"
//      },
//      "returns": {
//        "admit": "Whether the relation is admitted",
//        "relRev": "Specific relation revision admitted (0 = latest)"
//      }
//    },
//    "kindDescriptor(uint64,uint32)": {
//      "params": {
//        "id": "Kind ID",
//        "rev0": "Revision to query (0 = latest)"
//      },
//      "returns": {
//        "desc": "Descriptor at that revision"
//      }
//    },
//    "kindOwner(uint64)": {
//      "params": {
//        "id": "Kind ID"
//      },
//      "returns": {
//        "owner": "Owner address"
//      }
//    },
//    "kindRegister(bytes32,bytes32,uint8[],uint64[])": {
//      "params": {
//        "code": "Code hash of the kind",
//        "data": "Data hash of the kind",
//        "elemSpec": "Element type layout for objects of this kind",
//        "rels": "Supported relation IDs"
//      },
//      "returns": {
//        "desc": "Descriptor after registration",
//        "id": "New kind ID"
//      }
//    },
//    "kindRevision(uint64,uint32)": {
//      "params": {
//        "id": "Kind ID",
//        "rev0": "Revision to check (0 = latest)"
//      },
//      "returns": {
//        "rev": "Valid revision number (0 if not found)"
//      }
//    },
// }
// cat abis/IKindRegistry.json| jq .metadata.output.userdoc
// {
//   "kind": "user",
//   "methods": {
//     "kindAdmit(uint64,uint32,uint64)": {
//       "notice": "Checks whether a kind at a given revision admits a specific relation"
//     },
//     "kindDescriptor(uint64,uint32)": {
//       "notice": "Returns the descriptor at a given revision"
//     },
//   },
// }

export interface ContractFunctionDetail {
  abiFunction: any;
  name: string;
  signature: string;
  inputs: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  outputs: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  stateMutability: string;
  description: string;
  contractName: string;
  commandPath: string[];
}

export interface CommandConfig {
  name: string;
  abiFile: string;
  rename?: (func: string) => string;
  filter?: (func: ContractFunctionDetail) => boolean;
}

export interface UniverseConfig {
  name: string;
  rpcUrl: string;
  contracts: Record<string, string>; // contractName -> address
}

export interface EveryConfig {
  general: {
    default_universe: string;
  };
  universes: Record<
    string,
    {
      name: string;
      rpc_url: string;
      contracts: Record<string, string>;
    }
  >;
}
