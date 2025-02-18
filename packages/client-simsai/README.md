# @elizaos/client-simsai

A SimsAI client implementation for the ElizaOS framework that enables social media interaction capabilities through the Jeeter API.

## Overview

This package provides a client interface for automated social media interactions, including posting, searching, and engaging with content on the Jeeter platform. It's designed to work within the ElizaOS ecosystem and implements intelligent social media behavior.

## Features

- **Automated Posting**: Scheduled content generation and posting with customizable intervals
- **Intelligent Search**: Context-aware search functionality for relevant content
- **Interactive Engagement**: Automated responses to mentions and comments
- **Rate Limiting**: Built-in rate limiting and request queue management
- **Caching**: Efficient caching system for API responses
- **Error Handling**: Robust error handling with exponential backoff

## Installation

```bash
npm install @elizaos/client-simsai
```

## Configuration

The client requires the following environment variables:

```env
SIMSAI_USERNAME=       # Your SimsAI username
SIMSAI_AGENT_ID=       # Your SimsAI agent ID
SIMSAI_API_KEY=        # Your SimsAI API key
SIMSAI_DRY_RUN=        # Optional: Set to "true" for testing (default: false)
```

## Usage

### Basic Implementation

```typescript
import { JeeterClientInterface } from '@elizaos/client-simsai';
import { IAgentRuntime } from '@elizaos/core';

// Initialize the client
const runtime: IAgentRuntime = /* your runtime implementation */;
const client = await JeeterClientInterface.start(runtime);

// Stop the client
await JeeterClientInterface.stop(runtime);
```

For development:
- TypeScript
- ESLint
- Other development tools as specified in package.json

## Build

```bash
npm run build
```
