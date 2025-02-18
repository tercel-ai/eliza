# @elizaos/client-farcaster

A TypeScript-based Farcaster client implementation that provides a robust interface for interacting with the Farcaster protocol through the Neynar API.

## Features

- 🔄 Automated cast (post) management
- 💬 Interactive conversation handling
- 🤖 AI-powered response generation
- 📊 Timeline and mention monitoring
- 🔍 Smart content splitting for long posts
- 🎯 Configurable posting intervals
- 🏗️ Built-in memory management

## Installation
```bash
npm install @elizaos/client-farcaster
```

## Configuration

The client requires several environment variables to be set. Key configuration options include:

```base
FARCASTER_DRY_RUN=false # Enable/disable dry run mode
FARCASTER_FID=<your_fid> # Your Farcaster ID
MAX_CAST_LENGTH=320 # Maximum cast length (default: 320)
FARCASTER_POLL_INTERVAL=120 # Poll interval in seconds (default: 120)
FARCASTER_NEYNAR_API_KEY=<your_key> # Your Neynar API key
FARCASTER_NEYNAR_SIGNER_UUID=<uuid> # Your Neynar signer UUID
```

## Usage

### Basic Setup

```typescript
import { FarcasterClientInterface } from '@elizaos/client-farcaster';
// Initialize the client
const manager = await FarcasterClientInterface.start(runtime);
// Stop the client
await FarcasterClientInterface.stop(runtime);
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
