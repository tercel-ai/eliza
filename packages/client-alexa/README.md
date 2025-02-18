# @elizaos/client-alexa

A client package for integrating Alexa capabilities into the ElizaOS ecosystem. This package provides functionality for sending proactive events to Alexa and managing Alexa skill interactions.

## Features

- Alexa Skill Integration
- Proactive Event Support
- Secure Authentication Management
- Message Alert System

## Installation

This package is part of the ElizaOS workspace. Install it using your package manager:

```bash
npm install @elizaos/client-alexa
```

## Prerequisites

You need to set up the following environment variables:

- `ALEXA_SKILL_ID`: Your Alexa Skill ID
- `ALEXA_CLIENT_ID`: Your Alexa Client ID
- `ALEXA_CLIENT_SECRET`: Your Alexa Client Secret

## Usage

```typescript
import { AlexaClientInterface } from '@elizaos/client-alexa';
// Start the Alexa client
await AlexaClientInterface.start(runtime);
// Stop the Alexa client
await AlexaClientInterface.stop(runtime);
```

## Development

### Available Scripts

- `npm run build` - Build the package using tsup
- `npm run dev` - Start development mode with watch
- `npm run lint` - Run Biome linting
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Check formatting
- `npm run format:fix` - Fix formatting issues
- `npm run test` - Run tests
