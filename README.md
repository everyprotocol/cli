# Every CLI

A command-line interface for interacting with the Every Protocol.

## Installation

```bash
bun add -g @everyprotocol/every-cli
npm install -g @everyprotocol/every-cli
```

## Configuration

> **Note:** You normally don’t need to configure anything manually.
> A default configuration is bundled with support for all chains officially supported by the protocol.

The CLI looks for configuration in the following locations (in order of precedence):
1. `.every.toml` in the current directory
2. `.every.toml` in your home directory
3. The default configuration bundled with the package

Example configuration:

```toml
[universes.local]
rpc_url = "http://localhost:8545"
contracts.KindRegistry = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
contracts.SetRegistry = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
contracts.ElementRegistry = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
contracts.OmniRegistry = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
contracts.ObjectMinter = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"

[universes.testnet]
rpc_url = "https://testnet-rpc.example.com"
contracts.KindRegistry = "0x..."
# Add other contract addresses as needed
```

## Usage

The CLI provides commands for interacting with different aspects of the Every Protocol:

```bash
every --help
```

### Main Commands

- `every kind` - Manage kinds
- `every set` - Manage sets
- `every relation` - Manage relations
- `every unique` - Manage uniques
- `every value` - Manage values
- `every object` - Create and interact with objects
- `every mintpolicy` - Manage mint policies

### Examples

#### Minting an Object

```bash
every object mint 17.1 0xYourAddress
```

#### Relating objects

```bash
every object relate 17.1 42 18.2
```

#### Viewing Object Information

```bash
every object owner 17.1
```

### Signing Transactions

Most write operations require signing with a wallet or private key. You can provide your private key or use a keystore:

```bash
-k, --private-key <key>       Private key to sign the transaction
-a, --account <account>       Name of the keystore to sign the transaction
-p, --password [password]     Password to decrypt the keystore
-f, --password-file <file>    File containing the password to decrypt the keystore
    --foundry                 Use keystore from Foundry directory (~/.foundry/keystores)
```

#### Using a private key

```bash
every object mint 17.1 0xRecipient --private-key 0xYourPrivateKey
```
#### Using a keystore
```bash
every object mint 17.1 0xRecipient --account myaccount
```

## License
[MIT](LICENSE)
