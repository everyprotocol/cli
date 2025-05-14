
# Every CLI

A command-line interface for interacting with the Every Protocol.

## Installation

```bash
npm install -g @everyprotocol/every-cli
```

Or use it directly with npx:

```bash
npx @everyprotocol/every-cli
```

## Configuration

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

#### Creating a Relation Between Objects

```bash
every object relate 17.1 42 18.2
```

#### Viewing Object Information

```bash
every object owner 17.1
```

### Authentication

Most write operations require authentication. You can provide your private key or use a keystore:

```bash
# Using a private key
every object mint 17.1 0xRecipient --private-key 0xYourPrivateKey

# Using a keystore
every object mint 17.1 0xRecipient --account myaccount
```

## Development

### Building from Source

```bash
git clone https://github.com/everyprotocol/every-cli.git
cd every-cli
npm install
npm run build
```

### Running Tests

```bash
npm test
```

## License

[MIT](LICENSE)
