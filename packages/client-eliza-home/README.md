# SmartThings Integration Client for ElizaOS

## Overview
This project is a SmartThings integration client for ElizaOS, providing a robust interface for home automation control. It enables natural language processing for device control, state management, and automation handling through the SmartThings API.

## Features
- 🏠 Smart home device control and monitoring
- 🗣️ Natural language command processing
- 🔄 Real-time device state synchronization
- 🎯 Scene and room management
- 🤖 Automation state monitoring
- ⚡ Support for various device capabilities:
  - Switches
  - Lights
  - Thermostats
  - Locks
  - Motion Sensors
  - Contact Sensors
  - Media Players
  - and more...

## Installation
```bash
npm install @elizaos/client-eliza-home
```

## Configuration
The client requires a SmartThings API token for authentication. Set up your configuration by providing the following environment variables:

```env
# Required configuration
SMARTTHINGS_TOKEN=your_smartthings_api_token
```

## Usage

### Basic Setup
```typescript
import { startHome } from '@elizaos/client-eliza-home';
// Initialize the client
const homeClient = startHome(runtime);
```

### Command Handling
The client processes natural language commands through the SmartHomeManager:

```typescript
// Example command
const result = await homeClient.handleCommand('Turn on the kitchen light', 'user_id');
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
