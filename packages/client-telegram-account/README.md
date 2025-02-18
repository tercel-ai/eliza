# @elizaos/client-telegram-account

A Telegram client implementation for ElizaOS that enables AI-powered Telegram account automation and interaction.

## Features

- 🤖 AI-powered Telegram account automation
- 📱 Seamless Telegram account integration
- 💬 Intelligent message handling and response generation
- 🔄 Support for message threading and replies
- 📎 File and media attachment handling
- ✂️ Automatic message splitting for long responses
- 🔒 Secure session management

## Installation
```bash
npm install @elizaos/client-telegram-account
```

## Prerequisites

Before using this client, you'll need:

1. Telegram API credentials (APP_ID and APP_HASH) from https://my.telegram.org
2. A Telegram account phone number
3. ElizaOS Core runtime

## Configuration

The following environment variables are required:

```env
TELEGRAM_ACCOUNT_PHONE="+1234567890"
TELEGRAM_ACCOUNT_APP_ID=12345
TELEGRAM_ACCOUNT_APP_HASH="your-app-hash"
TELEGRAM_ACCOUNT_DEVICE_MODEL="Device Model"
TELEGRAM_ACCOUNT_SYSTEM_VERSION="System Version"
```

## Usage

```typescript
import { TelegramAccountClientInterface } from '@elizaos/client-telegram-account';
import { IAgentRuntime } from '@elizaos/core';
// Initialize with ElizaOS runtime
const runtime: IAgentRuntime = / your runtime instance /;
// Start the client
const client = await TelegramAccountClientInterface.start(runtime);
```


## Features in Detail

### Message Handling

The client automatically handles:
- Incoming messages
- Reply detection and threading
- Group chat mentions
- Direct messages
- Message formatting with Markdown support

### AI Integration

- Seamless integration with ElizaOS AI capabilities
- Context-aware responses
- Character personality maintenance
- Template-based response generation

### Security

- Secure session management
- Environment variable validation
- Error handling and logging

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
npm test:coverage # Gen
