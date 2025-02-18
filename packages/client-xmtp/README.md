# @elizaos/client-xmtp

A XMTP client implementation for ElizaOS that enables messaging capabilities through the XMTP protocol.

## Features

- XMTP protocol integration
- Seamless message handling and response generation
- Support for multiple messaging platforms (Converse, Coinbase Wallet, Farcaster Frame)
- Memory management for message history
- Action processing system
- Environment-based configuration

## Installation

```bash
npm install @elizaos/client-xmtp
```

## Prerequisites
```env
EVM_PRIVATE_KEY=your_private_key_here
```

## Usage
```
typescript
import { XmtpClientInterface } from '@elizaos/client-xmtp';
// Initialize the client with your runtime
const runtime = // your ElizaOS runtime
await XmtpClientInterface.start(runtime);
```

## Development

### Building
```bash
npm run build
npm run dev # Development mode with watch
```

### Running Tests
```bash
npm test # Run tests
npm test:watch # Watch mode
npm test:coverage # Generate coverage report
