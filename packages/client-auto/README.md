# @elizaos/client-auto

An automatic client implementation for ElizaOS.

## Installation

```bash
npm install @elizaos/client-auto
```

## Features

- Automated client that runs on a configurable interval
- Built on top of ElizaOS core functionality
- TypeScript support with full type definitions

## Usage

```typescript
import { AutoClientInterface } from '@elizaos/client-auto';
import { IAgentRuntime } from '@elizaos/core';
// Initialize with your runtime
const runtime: IAgentRuntime = / your runtime implementation /;
// Start the auto client
const client = await AutoClientInterface.start(runtime);
```

## Configuration

The auto client runs on an hourly interval by default. The client will automatically log its execution using the ElizaOS logger.

## API Reference

### `AutoClientInterface`

The main interface for interacting with the auto client.

Methods:
- `start(runtime: IAgentRuntime)`: Initializes and starts the auto client
- `stop(runtime: IAgentRuntime)`: Stops the client (currently not implemented)

### `AutoClient`

The underlying client implementation class.

Properties:
- `interval`: The NodeJS.Timeout that controls the execution interval
- `runtime`: The IAgentRuntime instance used by the client

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Watch mode for development
npm run dev
```