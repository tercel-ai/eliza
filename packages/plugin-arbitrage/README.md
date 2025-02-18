# @elizaos/plugin-arbitrage

A cryptocurrency arbitrage trading plugin for Eliza OS that monitors and executes profitable trading opportunities across multiple DEXs (Decentralized Exchanges).

## Features

- ⚡ Real-time market monitoring via WebSocket
- 💹 Automated arbitrage opportunity detection
- 🔄 Cross-DEX trading execution
- 📊 Price impact and trading fee analysis
- 🛡️ Flashbots integration for MEV protection
- ⚙️ Configurable trading parameters
- 🔍 Support for UniswapV2-compatible DEXs

## Installation

```bash
npm install @elizaos/plugin-arbitrage
```

## Usage

1. Configure your environment variables:

```env
ARBITRAGE_EVM_PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE
FLASHBOTS_RELAY_SIGNING_KEY=YOUR_FLASHBOTS_KEY_HERE
BUNDLE_EXECUTOR_ADDRESS=YOUR_EXECUTOR_ADDRESS_HERE
ARBITRAGE_ETHEREUM_WS_URL=YOUR_ETH_WSS_URL
ARBITRAGE_EVM_PROVIDER_URL=YOUR_ETH_RPC_URL
```

2. Import and use the plugin in your Eliza character:

```json
{
    "name": "Trader",
    "plugins": [
        "@elizaos/plugin-arbitrage",
        "@elizaos/plugin-evm"
    ],
    "settings": {
        "secrets": {
            "EVM_PRIVATE_KEY": "YOUR_PRIVATE_KEY_HERE",
            "FLASHBOTS_RELAY_SIGNING_KEY": "YOUR_FLASHBOTS_KEY_HERE",
            "BUNDLE_EXECUTOR_ADDRESS": "YOUR_EXECUTOR_ADDRESS_HERE"
        },
        "arbitrage": {
            "ethereumWsUrl": "YOUR_ETH_WSS_URL",
            "rpcUrl": "YOUR_ETH_RPC_URL"
        }
    }
}
```

3. The plugin provides the following actions:
- `EXECUTE_ARBITRAGE`: Scans and executes profitable arbitrage opportunities
- Market monitoring via WebSocket connection
- Automatic price impact and trading fee calculations

## Configuration

Key configuration parameters in `config/thresholds.ts`:

```typescript
{
    minProfitThreshold: "0.0001 ETH",  // Minimum profit to execute trade
    maxTradeSize: "1 ETH",             // Maximum trade size
    gasLimit: 500000,                  // Gas limit for transactions
    minerRewardPercentage: 90          // Flashbots miner reward percentage
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Acknowledgments

- Built on Eliza OS platform
- Uses Flashbots for MEV protection
- Supports UniswapV2-compatible DEXs
- Powered by ethers.js for Ethereum interaction
    