# @elizaos/plugin-story

A Story Protocol integration plugin for ElizaOS, providing functionality to interact with Story Protocol's IP management and licensing features.

## Features

- IP Asset Registration
- License Management
- IP Details Retrieval
- License Terms Management
- IPFS Integration

## Installation

```bash
npm install @elizaos/plugin-story
```

## Configuration

The plugin requires the following environment variables:
```env
STORY_API_BASE_URL= Story Protocol API base URL
PINATA_JWT= Pinata JWT for IPFS integration
STORY_API_KEY= Story Protocol API key
STORY_PRIVATE_KEY= Story Protocol private key
```

## Usage

### Initialize the Plugin

```typescript
import { storyPlugin } from '@elizaos/plugin-story';
// Add to your ElizaOS configuration
const config = {
    plugins: [storyPlugin],
// ... other config
};
```

### Available Actions

#### 1. Register IP Asset

Register a new IP asset with metadata on Story Protocol.

```typescript
const response = await registerIP({
title: "My IP Asset",
description: "Description of my IP asset",
ipType: "character" // Optional
});
```

#### 2. License IP Asset

Create a license for an existing IP asset.

```typescript
const response = await licenseIP({
licensorIpId: "0x...", // IP Asset address
licenseTermsId: "1", // License terms ID
amount: 1 // Optional: Number of licenses to mint
});
```

#### 3. Get IP Details

Retrieve details about an IP asset.

```typescript
const details = await getIPDetails({
ipId: "0x..." // IP Asset address
});
```

#### 4. Get Available Licenses

Fetch available licenses for an IP asset.

```typescript
const licenses = await getAvailableLicenses({
ipId: "0x..." // IP Asset address
});
```

#### 5. Attach License Terms

Attach license terms to an IP asset.

```typescript
const response = await attachTerms({
ipId: "0x...", // IP Asset address
mintingFee: 1.0, // Optional: Fee to mint license
commercialUse: true, // Optional: Allow commercial use
commercialRevShare: 10 // Optional: Revenue share percentage
});
```

## Development

### Project Structure

- `/src`
  - `/actions` - Action implementations
  - `/functions` - Utility functions
  - `/lib` - Core library code
  - `/providers` - Service providers
  - `/templates` - Template definitions
  - `/types` - TypeScript type definitions

### Build

```bash
npm run build
```

### Test

```bash
npm run test
```

### Lint

```bash
npm run lint
npm run lint:fix
```

### Format

```bash
npm run format
npm run format:fix
```

## Dependencies

- `@elizaos/core` - ElizaOS core framework
- `@pinata/sdk` - Pinata IPFS integration
- `@story-protocol/core-sdk` - Story Protocol SDK
- `viem` - Ethereum interactions
- `whatwg-url` - URL parsing

## License

This project is licensed under the terms specified in the package.json file.

## Contributing

Contributions are welcome! Please ensure you follow the project's code style and include appropriate tests with any pull requests.