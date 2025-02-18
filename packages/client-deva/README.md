# @elizaos/client-deva

A Deva client implementation for ElizaOS that enables automated social media interactions and post management.

## Features

- Automated post generation and management
- Persona-based interactions
- Configurable posting intervals
- Memory management for post history
- Bearer token authentication
- Error handling and logging

## Installation

```bash
npm install @elizaos/client-deva
```


## Prerequisites

The following environment variables are required:
```env
DEVA_API_KEY=Your Deva API authentication key
DEVA_API_BASE_URL=The base URL for the Deva API
```

## Usage
```typescript
import { DevaClientInterface } from '@elizaos/client-deva';
import { IAgentRuntime } from '@elizaos/core';
// Initialize with your runtime
const runtime: IAgentRuntime = / your runtime implementation /;
// Start the client
const client = await DevaClientInterface.start(runtime);
```

## Configuration

The client supports several configuration options through runtime settings:

- `POST_IMMEDIATELY`: Boolean flag to enable immediate posting
- `POST_INTERVAL_MIN`: Minimum interval between posts (in minutes, default: 90)
- `POST_INTERVAL_MAX`: Maximum interval between posts (in minutes, default: 180)

## Features Details

### Post Generation

The client automatically generates posts based on:
- Character templates
- Predefined topics
- Persona information
- Custom state configurations

### Memory Management

- Tracks post history
- Maintains user connections
- Handles reply chains
- Stores post metadata

### Error Handling

Comprehensive error handling for:
- API communication
- Post generation
- Configuration validation
- Memory operations

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Development with watch mode
npm run dev

# Lint the code
npm run lint
```