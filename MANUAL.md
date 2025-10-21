---
title: every
---

# every

CLI for interacting with Every Protocol

## Install

:::code-group

```shell [bun]
bun a -g @everyprotocol/every-cli
```

```shell [npm]
npm i -g @everyprotocol/every-cli
```

:::


## Usage

CLI for interacting with Every Protocol

```bash
every --help
```

```
Usage: every [options] [command]

CLI for interacting with Every Protocol

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  matter          manage matters
  set             manage sets
  kind            manage kinds
  relation        manage relations
  value           manage values
  unique          manage uniques
  object          create and interact with objects
  minter          manage mint policies
  balance
  wallet          manage wallets
  help [command]  display help for command
```

### every matter

manage matters

```bash
every matter --help
```

```
Usage: every matter [options] [command]

manage matters

Options:
  -h, --help                     display help for command

Commands:
  register [options] <files...>  Register matter on the Substrate chain
  help [command]                 display help for command
```

#### every matter register

Register matter on the Substrate chain

```bash
every matter register --help
```

```
Usage: every matter register [options] <files...>

Register matter on the Substrate chain

Arguments:
  files                      Path to the file(s) containing the matter content

Options:
  -c, --content-type <type>  Default content type
  -h, --hasher <number>      Default hasher (default: "1")
  -u, --universe <name>      Universe name
  -o, --observer <name>      Observer name
  -a, --account <account>    Name of the keystore
  -p, --password [password]  Password to decrypt the keystore
  --password-file <file>     File containing the keystore password
  -f, --foundry              use foundry keystores (~/.foundry/keystores)
  --help                     display help for command
```


### every set

manage sets

```bash
every set --help
```

```
Usage: every set [options] [command]

manage sets

Options:
  -h, --help                                         display help for command

Commands:
  register [options] <contract> <data>               Registers the set represented by the calling contract
  update [options] <contract> <data>                 Updates the content hash for the set represented by the calling contract
  upgrade [options] <contract> <kindRev0> <setRev0>  Upgrades the kind or set revision of the set represented by the calling contract
  touch [options] <contract>                         Increments the revision of the set represented by the calling contract
  owner [options] <id>                               Returns the current owner of a set
  descriptor [options] <id> <rev0>                   Returns the descriptor at a given revision
  revision [options] <id> <rev0>                     Resolves and validates a specific revision
  sota [options] <id>                                Returns the latest descriptor and current owner
  snapshot [options] <id> <rev0>                     Returns descriptor and elements of a set at a specific revision
  status [options] <ids>                             Checks whether all provided set IDs are active
  contract [options] <id>                            Returns the contract address associated with a set
  uri [options] <id> <objId> <objRev>                Returns the fully resolved URI for a specific object in a set
  uri2 [options] <id>                                Returns the URI template for objects in the given set
  help [command]                                     display help for command
```

#### every set register

Registers the set represented by the calling contract

```bash
every set register --help
```

```
Usage: every set register [options] <contract> <data>

Registers the set represented by the calling contract

Arguments:
  contract                   address of the set contract
  data                       Content hash (e.g., metadata or schema)

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every set update

Updates the content hash for the set represented by the calling contract

```bash
every set update --help
```

```
Usage: every set update [options] <contract> <data>

Updates the content hash for the set represented by the calling contract

Arguments:
  contract                   address of the set contract
  data                       New content hash

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every set upgrade

Upgrades the kind or set revision of the set represented by the calling contract

```bash
every set upgrade --help
```

```
Usage: every set upgrade [options] <contract> <kindRev0> <setRev0>

Upgrades the kind or set revision of the set represented by the calling contract

Arguments:
  contract                   address of the set contract
  kindRev0                   New kind revision (0 = no change)
  setRev0                    New set revision (0 = no change)

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every set touch

Increments the revision of the set represented by the calling contract

```bash
every set touch --help
```

```
Usage: every set touch [options] <contract>

Increments the revision of the set represented by the calling contract

Arguments:
  contract                   address of the set contract

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every set owner

Returns the current owner of a set

```bash
every set owner --help
```

```
Usage: every set owner [options] <id>

Returns the current owner of a set

Arguments:
  id                         Set ID

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every set descriptor

Returns the descriptor at a given revision

```bash
every set descriptor --help
```

```
Usage: every set descriptor [options] <id> <rev0>

Returns the descriptor at a given revision

Arguments:
  id                         Set ID
  rev0                       Revision to query (0 = latest)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every set revision

Resolves and validates a specific revision

```bash
every set revision --help
```

```
Usage: every set revision [options] <id> <rev0>

Resolves and validates a specific revision

Arguments:
  id                         Set ID
  rev0                       Requested revision (0 = latest)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every set sota

Returns the latest descriptor and current owner

```bash
every set sota --help
```

```
Usage: every set sota [options] <id>

Returns the latest descriptor and current owner

Arguments:
  id                         Set ID

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every set snapshot

Returns descriptor and elements of a set at a specific revision

```bash
every set snapshot --help
```

```
Usage: every set snapshot [options] <id> <rev0>

Returns descriptor and elements of a set at a specific revision

Arguments:
  id                         Set ID
  rev0                       Revision to query (0 = latest)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every set status

Checks whether all provided set IDs are active

```bash
every set status --help
```

```
Usage: every set status [options] <ids>

Checks whether all provided set IDs are active

Arguments:
  ids                        List of set IDs

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every set contract

Returns the contract address associated with a set

```bash
every set contract --help
```

```
Usage: every set contract [options] <id>

Returns the contract address associated with a set

Arguments:
  id                         Set ID

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every set uri

Returns the fully resolved URI for a specific object in a set

```bash
every set uri --help
```

```
Usage: every set uri [options] <id> <objId> <objRev>

Returns the fully resolved URI for a specific object in a set

Arguments:
  id                         Set ID
  objId                      Object ID (within the set)
  objRev                     Object revision number

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every set uri2

Returns the URI template for objects in the given set

```bash
every set uri2 --help
```

```
Usage: every set uri2 [options] <id>

Returns the URI template for objects in the given set

Arguments:
  id                         Set ID

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


### every kind

manage kinds

```bash
every kind --help
```

```
Usage: every kind [options] [command]

manage kinds

Options:
  -h, --help                                          display help for command

Commands:
  register [options] <code> <data> <elemSpec> <rels>  Registers a new kind
  update [options] <id> <code> <data> <rels>          Updates code, data, and relations of an existing kind
  update2 [options] <id> <code> <data>                Updates code and/or data of an existing kind
  update3 [options] <id> <rels>                       Updates supported relations of an existing kind
  upgrade [options] <id> <kindRev> <setRev>           Upgrades kind/set revision of an existing kind
  touch [options] <id>                                Touches a kind (bumps revision with no content changes)
  transfer [options] <id> <to>                        Transfers ownership of a kind
  owner [options] <id>                                Returns the current owner of a kind
  descriptor [options] <id> <rev0>                    Returns the descriptor at a given revision
  revision [options] <id> <rev0>                      Resolves and validates a specific revision
  sota [options] <id>                                 Returns the latest descriptor and current owner of a kind
  snapshot [options] <id> <rev0>                      Returns descriptor and elements at a specific revision
  status [options] <ids>                              Checks whether all specified kinds are active (rev > 0)
  admit [options] <kind> <rev> <rel>                  Checks whether a kind at a given revision admits a specific relation
  help [command]                                      display help for command
```

#### every kind register

Registers a new kind

```bash
every kind register --help
```

```
Usage: every kind register [options] <code> <data> <elemSpec> <rels>

Registers a new kind

Arguments:
  code                       Code hash of the kind
  data                       Data hash of the kind
  elemSpec                   Element type layout for objects of this kind
  rels                       Supported relation IDs

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every kind update

Updates code, data, and relations of an existing kind

```bash
every kind update --help
```

```
Usage: every kind update [options] <id> <code> <data> <rels>

Updates code, data, and relations of an existing kind

Arguments:
  id                         Kind ID
  code                       New code hash (0 = skip)
  data                       New data hash (0 = skip)
  rels                       Updated relation list

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every kind update2

Updates code and/or data of an existing kind

```bash
every kind update2 --help
```

```
Usage: every kind update2 [options] <id> <code> <data>

Updates code and/or data of an existing kind

Arguments:
  id                         Kind ID
  code                       New code hash (0 = skip)
  data                       New data hash (0 = skip)

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every kind update3

Updates supported relations of an existing kind

```bash
every kind update3 --help
```

```
Usage: every kind update3 [options] <id> <rels>

Updates supported relations of an existing kind

Arguments:
  id                         Kind ID
  rels                       Updated relation list

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every kind upgrade

Upgrades kind/set revision of an existing kind

```bash
every kind upgrade --help
```

```
Usage: every kind upgrade [options] <id> <kindRev> <setRev>

Upgrades kind/set revision of an existing kind

Arguments:
  id                         Kind ID
  kindRev                    New kind revision (0 = skip)
  setRev                     New set revision (0 = skip)

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every kind touch

Touches a kind (bumps revision with no content changes)

```bash
every kind touch --help
```

```
Usage: every kind touch [options] <id>

Touches a kind (bumps revision with no content changes)

Arguments:
  id                         Kind ID

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every kind transfer

Transfers ownership of a kind

```bash
every kind transfer --help
```

```
Usage: every kind transfer [options] <id> <to>

Transfers ownership of a kind

Arguments:
  id                         Kind ID
  to                         New owner address

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every kind owner

Returns the current owner of a kind

```bash
every kind owner --help
```

```
Usage: every kind owner [options] <id>

Returns the current owner of a kind

Arguments:
  id                         Kind ID

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every kind descriptor

Returns the descriptor at a given revision

```bash
every kind descriptor --help
```

```
Usage: every kind descriptor [options] <id> <rev0>

Returns the descriptor at a given revision

Arguments:
  id                         Kind ID
  rev0                       Revision to query (0 = latest)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every kind revision

Resolves and validates a specific revision

```bash
every kind revision --help
```

```
Usage: every kind revision [options] <id> <rev0>

Resolves and validates a specific revision

Arguments:
  id                         Kind ID
  rev0                       Revision to check (0 = latest)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every kind sota

Returns the latest descriptor and current owner of a kind

```bash
every kind sota --help
```

```
Usage: every kind sota [options] <id>

Returns the latest descriptor and current owner of a kind

Arguments:
  id                         Kind ID

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every kind snapshot

Returns descriptor and elements at a specific revision

```bash
every kind snapshot --help
```

```
Usage: every kind snapshot [options] <id> <rev0>

Returns descriptor and elements at a specific revision

Arguments:
  id                         Kind ID
  rev0                       Revision to query (0 = latest)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every kind status

Checks whether all specified kinds are active (rev > 0)

```bash
every kind status --help
```

```
Usage: every kind status [options] <ids>

Checks whether all specified kinds are active (rev > 0)

Arguments:
  ids                        List of kind IDs

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every kind admit

Checks whether a kind at a given revision admits a specific relation

```bash
every kind admit --help
```

```
Usage: every kind admit [options] <kind> <rev> <rel>

Checks whether a kind at a given revision admits a specific relation

Arguments:
  kind                       Kind ID
  rev                        Kind revision (0 = latest)
  rel                        Relation ID to check

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


### every relation

manage relations

```bash
every relation --help
```

```
Usage: every relation [options] [command]

manage relations

Options:
  -h, --help                                      display help for command

Commands:
  register [options] <code> <data> <rule> <adjs>  Registers a new relation
  update [options] <id> <data>                    Updates the data hash of a relation
  update2 [options] <id> <data> <adjs>            Updates the data hash and adjacency configuration of a relation
  upgrade [options] <id> <kindRev> <setRev>       Upgrades the kind or set revision of a relation
  touch [options] <id>                            Touches a relation (bumps revision without modifying content)
  transfer [options] <id> <to>                    Transfers ownership of a relation to a new address
  owner [options] <id>                            Gets the current owner of a relation
  descriptor [options] <id> <rev0>                Returns descriptor of a relation at a specific revision
  revision [options] <id> <rev0>                  Resolves and validates a revision number
  sota [options] <id>                             Returns the latest descriptor and current owner of a relation
  snapshot [options] <id> <rev0>                  Returns descriptor and packed elements at a specific revision
  status [options] <ids>                          Checks whether all specified relations are active (rev > 0)
  rule [options] <id>                             Returns the rule definition for a relation
  admit [options] <id> <rev> <kind>               Checks if a relation admits a specific kind as tail
  help [command]                                  display help for command
```

#### every relation register

Registers a new relation

```bash
every relation register --help
```

```
Usage: every relation register [options] <code> <data> <rule> <adjs>

Registers a new relation

Arguments:
  code                       Optional logic contract address
  data                       Hash of the relation’s associated data
  rule                       Rule defining the behavior and constraints of the relation
  adjs                       Array of tail kind admissibility and degree limits

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every relation update

Updates the data hash of a relation

```bash
every relation update --help
```

```
Usage: every relation update [options] <id> <data>

Updates the data hash of a relation

Arguments:
  id                         Relation ID
  data                       New data hash

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every relation update2

Updates the data hash and adjacency configuration of a relation

```bash
every relation update2 --help
```

```
Usage: every relation update2 [options] <id> <data> <adjs>

Updates the data hash and adjacency configuration of a relation

Arguments:
  id                         Relation ID
  data                       New data hash
  adjs                       New array of adjacency rules

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every relation upgrade

Upgrades the kind or set revision of a relation

```bash
every relation upgrade --help
```

```
Usage: every relation upgrade [options] <id> <kindRev> <setRev>

Upgrades the kind or set revision of a relation

Arguments:
  id                         Relation ID
  kindRev                    New kind revision (0 = no change)
  setRev                     New set revision (0 = no change)

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every relation touch

Touches a relation (bumps revision without modifying content)

```bash
every relation touch --help
```

```
Usage: every relation touch [options] <id>

Touches a relation (bumps revision without modifying content)

Arguments:
  id                         Relation ID

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every relation transfer

Transfers ownership of a relation to a new address

```bash
every relation transfer --help
```

```
Usage: every relation transfer [options] <id> <to>

Transfers ownership of a relation to a new address

Arguments:
  id                         Relation ID
  to                         New owner address

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every relation owner

Gets the current owner of a relation

```bash
every relation owner --help
```

```
Usage: every relation owner [options] <id>

Gets the current owner of a relation

Arguments:
  id                         Relation ID

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every relation descriptor

Returns descriptor of a relation at a specific revision

```bash
every relation descriptor --help
```

```
Usage: every relation descriptor [options] <id> <rev0>

Returns descriptor of a relation at a specific revision

Arguments:
  id                         Relation ID
  rev0                       Revision to query (0 = latest)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every relation revision

Resolves and validates a revision number

```bash
every relation revision --help
```

```
Usage: every relation revision [options] <id> <rev0>

Resolves and validates a revision number

Arguments:
  id                         Relation ID
  rev0                       Requested revision (0 = latest)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every relation sota

Returns the latest descriptor and current owner of a relation

```bash
every relation sota --help
```

```
Usage: every relation sota [options] <id>

Returns the latest descriptor and current owner of a relation

Arguments:
  id                         Relation ID

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every relation snapshot

Returns descriptor and packed elements at a specific revision

```bash
every relation snapshot --help
```

```
Usage: every relation snapshot [options] <id> <rev0>

Returns descriptor and packed elements at a specific revision

Arguments:
  id                         Relation ID
  rev0                       Revision to query (0 = latest)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every relation status

Checks whether all specified relations are active (rev > 0)

```bash
every relation status --help
```

```
Usage: every relation status [options] <ids>

Checks whether all specified relations are active (rev > 0)

Arguments:
  ids                        Array of relation IDs

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every relation rule

Returns the rule definition for a relation

```bash
every relation rule --help
```

```
Usage: every relation rule [options] <id>

Returns the rule definition for a relation

Arguments:
  id                         Relation ID

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every relation admit

Checks if a relation admits a specific kind as tail

```bash
every relation admit --help
```

```
Usage: every relation admit [options] <id> <rev> <kind>

Checks if a relation admits a specific kind as tail

Arguments:
  id                         Relation ID
  rev                        Revision to check
  kind                       Tail kind ID to evaluate

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


### every value

manage values

```bash
every value --help
```

```
Usage: every value [options] [command]

manage values

Options:
  -h, --help                                                  display help for command

Commands:
  register [options] <code> <data> <std> <decimals> <symbol>  Registers a new value token
  update [options] <id> <data>                                Updates the data hash of an existing value
  update2 [options] <id> <data> <symbol>                      Updates the data hash and symbol of an existing value
  upgrade [options] <id> <kindRev0> <setRev0>                 Upgrades the kind/set revision of a value
  touch [options] <id>                                        Touches a value, bumping its revision without changing its content
  transfer [options] <id> <to>                                Transfers ownership of a value to a new address
  owner [options] <id>                                        Returns the current owner of a value
  descriptor [options] <id> <rev0>                            Returns the descriptor of a value at a specific revision
  revision [options] <id> <rev0>                              Resolves and validates a revision of a value
  sota [options] <id>                                         Returns the latest descriptor and current owner of a value
  snapshot [options] <id> <rev0>                              Returns descriptor and elements of a value at a specific revision
  status [options] <ids>                                      Checks whether all specified values are active (revision > 0)
  help [command]                                              display help for command
```

#### every value register

Registers a new value token

```bash
every value register --help
```

```
Usage: every value register [options] <code> <data> <std> <decimals> <symbol>

Registers a new value token

Arguments:
  code                       Token contract address
  data                       Hash of the underlying matter or metadata
  std                        Token standard (e.g. ERC20)
  decimals                   Token's decimal precision
  symbol                     Display symbol (max 30 characters)

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every value update

Updates the data hash of an existing value

```bash
every value update --help
```

```
Usage: every value update [options] <id> <data>

Updates the data hash of an existing value

Arguments:
  id                         Value ID
  data                       New data hash

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every value update2

Updates the data hash and symbol of an existing value

```bash
every value update2 --help
```

```
Usage: every value update2 [options] <id> <data> <symbol>

Updates the data hash and symbol of an existing value

Arguments:
  id                         Value ID
  data                       New data hash
  symbol                     New display symbol

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every value upgrade

Upgrades the kind/set revision of a value

```bash
every value upgrade --help
```

```
Usage: every value upgrade [options] <id> <kindRev0> <setRev0>

Upgrades the kind/set revision of a value

Arguments:
  id                         Value ID
  kindRev0                   New kind revision (0 = no change)
  setRev0                    New set revision (0 = no change)

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every value touch

Touches a value, bumping its revision without changing its content

```bash
every value touch --help
```

```
Usage: every value touch [options] <id>

Touches a value, bumping its revision without changing its content

Arguments:
  id                         Value ID

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every value transfer

Transfers ownership of a value to a new address

```bash
every value transfer --help
```

```
Usage: every value transfer [options] <id> <to>

Transfers ownership of a value to a new address

Arguments:
  id                         Value ID
  to                         Address to transfer ownership to

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every value owner

Returns the current owner of a value

```bash
every value owner --help
```

```
Usage: every value owner [options] <id>

Returns the current owner of a value

Arguments:
  id                         Value ID

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every value descriptor

Returns the descriptor of a value at a specific revision

```bash
every value descriptor --help
```

```
Usage: every value descriptor [options] <id> <rev0>

Returns the descriptor of a value at a specific revision

Arguments:
  id                         Value ID
  rev0                       Revision to query (0 = latest)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every value revision

Resolves and validates a revision of a value

```bash
every value revision --help
```

```
Usage: every value revision [options] <id> <rev0>

Resolves and validates a revision of a value

Arguments:
  id                         Value ID
  rev0                       Requested revision (0 = latest)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every value sota

Returns the latest descriptor and current owner of a value

```bash
every value sota --help
```

```
Usage: every value sota [options] <id>

Returns the latest descriptor and current owner of a value

Arguments:
  id                         Value ID

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every value snapshot

Returns descriptor and elements of a value at a specific revision

```bash
every value snapshot --help
```

```
Usage: every value snapshot [options] <id> <rev0>

Returns descriptor and elements of a value at a specific revision

Arguments:
  id                         Value ID
  rev0                       Revision to query (0 = latest)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every value status

Checks whether all specified values are active (revision > 0)

```bash
every value status --help
```

```
Usage: every value status [options] <ids>

Checks whether all specified values are active (revision > 0)

Arguments:
  ids                        Array of value IDs

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


### every unique

manage uniques

```bash
every unique --help
```

```
Usage: every unique [options] [command]

manage uniques

Options:
  -h, --help                                                  display help for command

Commands:
  register [options] <code> <data> <std> <decimals> <symbol>  Registers a new unique token
  update [options] <id> <data>                                Updates the data hash of a unique
  update2 [options] <id> <data> <symbol>                      Updates the data hash and symbol of a unique
  upgrade [options] <id> <kindRev> <setRev>                   Upgrades the kind and/or set revision of a unique
  touch [options] <id>                                        Bumps the revision of a unique with no content change
  transfer [options] <id> <to>                                Transfers ownership of a unique token
  owner [options] <id>                                        Returns the current owner of a unique
  descriptor [options] <id> <rev0>                            Returns the descriptor at a given revision
  revision [options] <id> <rev0>                              Resolves and validates a revision
  sota [options] <id>                                         Returns the latest descriptor and current owner
  snapshot [options] <id> <rev0>                              Returns descriptor and elements at a specific revision
  status [options] <ids>                                      Checks whether all given uniques are active (revision > 0)
  help [command]                                              display help for command
```

#### every unique register

Registers a new unique token

```bash
every unique register --help
```

```
Usage: every unique register [options] <code> <data> <std> <decimals> <symbol>

Registers a new unique token

Arguments:
  code                       Address of the token contract
  data                       Hash of the associated matter
  std                        Token standard (e.g. ERC721)
  decimals                   Number of decimals
  symbol                     Display symbol (max 30 characters)

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every unique update

Updates the data hash of a unique

```bash
every unique update --help
```

```
Usage: every unique update [options] <id> <data>

Updates the data hash of a unique

Arguments:
  id                         Unique ID
  data                       New data hash

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every unique update2

Updates the data hash and symbol of a unique

```bash
every unique update2 --help
```

```
Usage: every unique update2 [options] <id> <data> <symbol>

Updates the data hash and symbol of a unique

Arguments:
  id                         Unique ID
  data                       New data hash
  symbol                     New display symbol (max 30 characters)

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every unique upgrade

Upgrades the kind and/or set revision of a unique

```bash
every unique upgrade --help
```

```
Usage: every unique upgrade [options] <id> <kindRev> <setRev>

Upgrades the kind and/or set revision of a unique

Arguments:
  id                         Unique ID
  kindRev                    New kind revision (0 = no change)
  setRev                     New set revision (0 = no change)

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every unique touch

Bumps the revision of a unique with no content change

```bash
every unique touch --help
```

```
Usage: every unique touch [options] <id>

Bumps the revision of a unique with no content change

Arguments:
  id                         Unique ID

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every unique transfer

Transfers ownership of a unique token

```bash
every unique transfer --help
```

```
Usage: every unique transfer [options] <id> <to>

Transfers ownership of a unique token

Arguments:
  id                         Unique ID
  to                         Address of the new owner

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every unique owner

Returns the current owner of a unique

```bash
every unique owner --help
```

```
Usage: every unique owner [options] <id>

Returns the current owner of a unique

Arguments:
  id                         Unique ID

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every unique descriptor

Returns the descriptor at a given revision

```bash
every unique descriptor --help
```

```
Usage: every unique descriptor [options] <id> <rev0>

Returns the descriptor at a given revision

Arguments:
  id                         Unique ID
  rev0                       Revision to query (0 = latest)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every unique revision

Resolves and validates a revision

```bash
every unique revision --help
```

```
Usage: every unique revision [options] <id> <rev0>

Resolves and validates a revision

Arguments:
  id                         Unique ID
  rev0                       Requested revision (0 = latest)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every unique sota

Returns the latest descriptor and current owner

```bash
every unique sota --help
```

```
Usage: every unique sota [options] <id>

Returns the latest descriptor and current owner

Arguments:
  id                         Unique ID

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every unique snapshot

Returns descriptor and elements at a specific revision

```bash
every unique snapshot --help
```

```
Usage: every unique snapshot [options] <id> <rev0>

Returns descriptor and elements at a specific revision

Arguments:
  id                         Unique ID
  rev0                       Revision to query (0 = latest)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every unique status

Checks whether all given uniques are active (revision > 0)

```bash
every unique status --help
```

```
Usage: every unique status [options] <ids>

Checks whether all given uniques are active (revision > 0)

Arguments:
  ids                        List of unique IDs

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


### every object

create and interact with objects

```bash
every object --help
```

```
Usage: every object [options] [command]

create and interact with objects

Options:
  -h, --help                                    display help for command

Commands:
  mint [options] <sid> [data]                   Mint an object via the object minter or directly from the set
  update [options] <sid> <data>                 Update an existing object
  upgrade [options] <sid> <kindRev0> <setRev0>  Upgrade an object to a new kind or set revision
  touch [options] <sid>                         Touch an object to increment revision without content change
  transfer [options] <sid> <to>                 Transfer ownership of an object
  relate [options] <tail> <rel> <head>          Link a tail object to a head object through a relation
  unrelate [options] <tail> <rel> <head>        Unlinks a tail object from a head object
  owner [options] <sid>                         Get current owner of an object
  descriptor [options] <sid> <rev0>             Get descriptor at a specific revision
  snapshot [options] <sid> <rev0>               Get descriptor and elements at a specific revision
  uri [options] <sid>                           Get URI template for metadata
  create [options] <sid> <id0> <data>           Create (mint) a new object
  help [command]                                display help for command
```

#### every object mint

Mint an object via the object minter or directly from the set

```bash
every object mint --help
```

```
Usage: every object mint [options] <sid> [data]

Mint an object via the object minter or directly from the set

Arguments:
  sid                        scoped object ID, in form of set.id (e.g., 17.1)
  data                       additional input data (default: "0x")

Options:
  --to <address>             specify the recipient
  --value <amount>           the amount of ETH to send together (default: "0")
  --auth <data>              authorization data for a permissioned mint (default: "0x")
  --policy <index>           the index number of the mint policy (default: "0")
  --no-minter                mint directly from set contract instead of using ObjectMinter
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every object update

Update an existing object

```bash
every object update --help
```

```
Usage: every object update [options] <sid> <data>

Update an existing object

Arguments:
  sid                        Scoped Object ID (in form of set.id, e.g., 17.1)
  data                       Encoded update parameters

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every object upgrade

Upgrade an object to a new kind or set revision

```bash
every object upgrade --help
```

```
Usage: every object upgrade [options] <sid> <kindRev0> <setRev0>

Upgrade an object to a new kind or set revision

Arguments:
  sid                        Scoped Object ID (in form of set.id, e.g., 17.1)
  kindRev0                   New kind revision (0 = no change)
  setRev0                    New set revision (0 = no change)

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every object touch

Touch an object to increment revision without content change

```bash
every object touch --help
```

```
Usage: every object touch [options] <sid>

Touch an object to increment revision without content change

Arguments:
  sid                        Scoped Object ID (in form of set.id, e.g., 17.1)

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every object transfer

Transfer ownership of an object

```bash
every object transfer --help
```

```
Usage: every object transfer [options] <sid> <to>

Transfer ownership of an object

Arguments:
  sid                        Scoped Object ID (in form of set.id, e.g., 17.1)
  to                         Address of the new owner

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every object relate

Link a tail object to a head object through a relation

```bash
every object relate --help
```

```
Usage: every object relate [options] <tail> <rel> <head>

Link a tail object to a head object through a relation

Arguments:
  tail                       tail node, in form of [[data.]grant.]set.id
  rel                        relation ID
  head                       head node in form of [grant.]set.id,

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every object unrelate

Unlinks a tail object from a head object

```bash
every object unrelate --help
```

```
Usage: every object unrelate [options] <tail> <rel> <head>

Unlinks a tail object from a head object

Arguments:
  tail                       tail node, in form of [[data.]grant.]set.id
  rel                        relation ID
  head                       head node in form of [grant.]set.id,

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every object owner

Get current owner of an object

```bash
every object owner --help
```

```
Usage: every object owner [options] <sid>

Get current owner of an object

Arguments:
  sid                        Scoped Object ID (in form of set.id, e.g., 17.1)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every object descriptor

Get descriptor at a specific revision

```bash
every object descriptor --help
```

```
Usage: every object descriptor [options] <sid> <rev0>

Get descriptor at a specific revision

Arguments:
  sid                        Scoped Object ID (in form of set.id, e.g., 17.1)
  rev0                       Revision number (0 = latest)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every object snapshot

Get descriptor and elements at a specific revision

```bash
every object snapshot --help
```

```
Usage: every object snapshot [options] <sid> <rev0>

Get descriptor and elements at a specific revision

Arguments:
  sid                        Scoped Object ID (in form of set.id, e.g., 17.1)
  rev0                       Revision number to query (0 = latest)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every object uri

Get URI template for metadata

```bash
every object uri --help
```

```
Usage: every object uri [options] <sid>

Get URI template for metadata

Arguments:
  sid                        Scoped Object ID (in form of set.id, e.g., 17.1)

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every object create

Create (mint) a new object

```bash
every object create --help
```

```
Usage: every object create [options] <sid> <id0> <data>

Create (mint) a new object

Arguments:
  sid                        Scoped Object ID (in form of set.id, e.g., 17.1)
  id0                        Requested object ID (0 = auto-assign)
  data                       Encoded creation parameters

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


### every minter

manage mint policies

```bash
every minter --help
```

```
Usage: every minter [options] [command]

manage mint policies

Options:
  -h, --help                                   display help for command

Commands:
  add [options] <contract> <policy>            Adds a new mint policy for the set represented by the calling contract
  disable [options] <contract> <index>         Disables a mint policy for the set represented by the calling contract
  enable [options] <contract> <index>          Enables a mint policy for the set represented by the calling contract
  count [options] <set>                        Get number of mint policies for a set
  get [options] <set> <index>                  Get mint policy by index
  search [options] <set> <id> <mask> <offset>  Search for applicable mint policy with offset and permission mask
  search2 [options] <set> <id> <mask>          Search for applicable mint policy with permission mask
  help [command]                               display help for command
```

#### every minter add

Adds a new mint policy for the set represented by the calling contract

```bash
every minter add --help
```

```
Usage: every minter add [options] <contract> <policy>

Adds a new mint policy for the set represented by the calling contract

Arguments:
  contract                   address of the contract
  policy                     The policy configuration to add

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every minter disable

Disables a mint policy for the set represented by the calling contract

```bash
every minter disable --help
```

```
Usage: every minter disable [options] <contract> <index>

Disables a mint policy for the set represented by the calling contract

Arguments:
  contract                   address of the contract
  index                      Index of the policy to disable

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every minter enable

Enables a mint policy for the set represented by the calling contract

```bash
every minter enable --help
```

```
Usage: every minter enable [options] <contract> <index>

Enables a mint policy for the set represented by the calling contract

Arguments:
  contract                   address of the contract
  index                      Index of the policy to enable

Options:
  -u, --universe <universe>  universe name (default: "local")
  -k, --private-key <key>    private key to sign the transaction
  -a, --account <account>    name of the keystore to sign the transaction
  -p, --password [password]  password to decrypt the keystore
  --password-file <file>     file containing the password to decrypt the keystore
  -f, --foundry              use keystore from Foundry directory (~/.foundry/keystores)
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every minter count

Get number of mint policies for a set

```bash
every minter count --help
```

```
Usage: every minter count [options] <set>

Get number of mint policies for a set

Arguments:
  set                        The set address to query

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every minter get

Get mint policy by index

```bash
every minter get --help
```

```
Usage: every minter get [options] <set> <index>

Get mint policy by index

Arguments:
  set                        The set address
  index                      Policy index

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every minter search

Search for applicable mint policy with offset and permission mask

```bash
every minter search --help
```

```
Usage: every minter search [options] <set> <id> <mask> <offset>

Search for applicable mint policy with offset and permission mask

Arguments:
  set                        The set address
  id                         The object ID to check
  mask                       Bitmask indicating which MintPermissionType values are included.             Each bit corresponds to a permission type
                             (e.g., bit 0 = Public, bit 1 = Allowlist, etc.).
  offset                     Starting policy index to search from

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


#### every minter search2

Search for applicable mint policy with permission mask

```bash
every minter search2 --help
```

```
Usage: every minter search2 [options] <set> <id> <mask>

Search for applicable mint policy with permission mask

Arguments:
  set                        The set address
  id                         The object ID to check
  mask                       Bitmask indicating which MintPermissionType values are included.             Each bit corresponds to a permission type
                             (e.g., bit 0 = Public, bit 1 = Allowlist, etc.).

Options:
  -u, --universe <universe>  universe name (default: "local")
  --dry-run                  Simulate the command without sending a transaction
  -h, --help                 display help for command
```


### every balance



```bash
every balance --help
```

```
Usage: every balance [options] [command]

Options:
  -h, --help                             display help for command

Commands:
  query [options] <address>              Query account balance
  transfer [options] <address> <amount>  Transfer balance to account
  help [command]                         display help for command
```

#### every balance query

Query account balance

```bash
every balance query --help
```

```
Usage: every balance query [options] <address>

Query account balance

Arguments:
  address                Account address (SS58 or 0x hex)

Options:
  -n, --observer <name>  Observer name from config (default: "localnet")
  -h, --help             display help for command
```


#### every balance transfer

Transfer balance to account

```bash
every balance transfer --help
```

```
Usage: every balance transfer [options] <address> <amount>

Transfer balance to account

Arguments:
  address                    Recipient account address (SS58 or 0x hex)
  amount                     Amount in base units

Options:
  -a, --account <account>    Name of the keystore
  -p, --password [password]  Password to decrypt the keystore
  --password-file <file>     File containing the keystore password
  -f, --foundry              use foundry keystores (~/.foundry/keystores)
  -n, --observer <name>      Observer name from config (default: "localnet")
  -h, --help                 display help for command
```


### every wallet

manage wallets

```bash
every wallet --help
```

```
Usage: every wallet [options] [command]

manage wallets

Options:
  -h, --help                      display help for command

Commands:
  list [options]                  List all wallets
  new [options] <name>            Generate a new wallet
  import [options] <name> <suri>  Import a wallet from a secrete URI
  inspect [options] <name>        Inspect a wallet
  help [command]                  display help for command
```

#### every wallet list

List all wallets

```bash
every wallet list --help
```

```
Usage: every wallet list [options]

List all wallets

Options:
  -f, --foundry  use foundry keystore directory (~/.foundry/keystores)
  --dir <dir>    specify a custom keystore directory
  -h, --help     display help for command
```


#### every wallet new

Generate a new wallet

```bash
every wallet new --help
```

```
Usage: every wallet new [options] <name>

Generate a new wallet

Arguments:
  name                        name of the wallet

Options:
  -t, --type <type>           key type (sr25519, ed25519, ethereum) (default: "sr25519")
  -p, --password <password>   password to encrypt the keystore
  -P, --password-file <file>  password file
  --dir <dir>                 specify keystore directory
  -h, --help                  display help for command
```


#### every wallet import

Import a wallet from a secrete URI

```bash
every wallet import --help
```

```
Usage: every wallet import [options] <name> <suri>

Import a wallet from a secrete URI

Arguments:
  name                        name of the wallet
  suri                        secret URI

Options:
  -t, --type <type>           key type (sr25519, ed25519, ethereum) (default: "sr25519")
  -p, --password <password>   password to encrypt the keystore
  -P, --password-file <file>  password file
  --dir <dir>                 specify a custom keystore directory
  -f, --foundry               use foundry keystore directory (~/.foundry/keystores)
  -h, --help                  display help for command
```


#### every wallet inspect

Inspect a wallet

```bash
every wallet inspect --help
```

```
Usage: every wallet inspect [options] <name>

Inspect a wallet

Arguments:
  name                        name of the wallet

Options:
  -t, --type <type>           key type (sr25519, ed25519, ethereum) (default: "sr25519")
  -p, --password <password>   password to decrypt the keystore
  -P, --password-file <file>  file containing the password
  -x, --decrypt               also decrypt the private key (default: false)
  --dir <dir>                 specify a custom keystore directory
  -f, --foundry               use foundry keystore directory (~/.foundry/keystores)
  -h, --help                  display help for command
```
