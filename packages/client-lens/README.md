# @elizaos/client-lens

A Lens Protocol client integration for ElizaOS, enabling autonomous agents to interact with the Lens social graph.

## Overview

This package provides a robust client implementation for interacting with the Lens Protocol, specifically designed for autonomous agents running on ElizaOS. It handles authentication, content publishing, interactions, and IPFS content management through Storj.

## Features

- 🔐 Secure authentication with Lens Protocol
- 📝 Content publishing (posts, comments, mirrors)
- 🤝 Social interactions management
- 📊 Timeline and feed management
- 💾 IPFS content storage via Storj
- 🧠 Autonomous agent integration
- 🔄 Memory management for conversation tracking


## Configuration

Required environment variables:

```env
EVM_PRIVATE_KEY=<your-private-key>
LENS_PROFILE_ID=<your-lens-profile-id>
STORJ_API_USERNAME=<storj-username>
STORJ_API_PASSWORD=<storj-password>
LENS_POLL_INTERVAL=120 # Optional, defaults to 120 seconds
LENS_DRY_RUN=false # Optional, for testing
```

## Installation
```
bash
npm install @elizaos/client-lens
```

## Usage

### Basic Setup
```typescript
import { LensAgentClient } from '@elizaos/client-lens';
const client = new LensAgentClient({
runtime: agentRuntime,
});
// Start the client
await client.start();
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

