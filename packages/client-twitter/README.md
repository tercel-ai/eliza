# @elizaos/client-twitter

A Twitter/X client library for ElizaOS that enables autonomous social interactions through various specialized modules.

## Features

- **Base Operations**: Handles core Twitter functionality like authentication, timeline management, and caching
- **Post Generation**: Autonomous tweet creation and scheduling
- **Search & Engagement**: Configurable search and response capabilities
- **Interaction Management**: Handles mentions, replies, and user engagement
- **Spaces Support**: Optional Twitter Spaces functionality
- **Approval Workflow**: Optional Discord-based tweet approval system

## Installation
```bash
npm install @elizaos/client-twitter
```


## Configuration

The client requires several environment variables for configuration. Here are the key settings:

```base
TWITTER_ENABLED: boolean; // Optional: Enable Twitter client (default: true)
TWITTER_USERNAME: string; // Required: Twitter username
TWITTER_PASSWORD: string; // Required: Twitter password
TWITTER_EMAIL: string; // Required: Twitter email
TWITTER_2FA_SECRET?: string; // Optional: 2FA secret if enabled
TWITTER_DRY_RUN?: boolean; // Optional: Run without posting (default: false)
MAX_TWEET_LENGTH?: number; // Optional: Max tweet length (default: 280)
TWITTER_SEARCH_ENABLE?: boolean; // Optional: Enable search features
TWITTER_TARGET_USERS?: string[]; // Optional: Users to monitor
POST_INTERVAL_MIN?: number; // Optional: Min posting interval (mins)
POST_INTERVAL_MAX?: number; // Optional: Max posting interval (mins)
TWITTER_RETRY_LIMIT?: number; // Optional: Retry limit
TWITTER_POLL_INTERVAL?: number; // Optional: Poll interval (seconds)
TWITTER_SPACES_ENABLE?: boolean; // Optional: Enable Spaces features
ENABLE_TWITTER_POST_GENERATION?: boolean; // Optional: Enable post generation
ENABLE_ACTION_PROCESSING?: boolean; // Optional: Enable action processing
ACTION_INTERVAL?: number; // Optional: Action interval (minutes)
POST_IMMEDIATELY?: boolean; // Optional: Post immediately
TWITTER_SPACES_ENABLE?: boolean; // Optional: Enable Spaces features
MAX_ACTIONS_PROCESSING?: number; // Optional: Max actions to process
ACTION_TIMELINE_TYPE?: string; // Optional: Action timeline type
TWITTER_APPROVAL_ENABLED?: boolean; // Optional: Enable approval workflow
TWITTER_APPROVAL_DISCORD_BOT_TOKEN?: string; // Optional: Discord bot token
TWITTER_APPROVAL_DISCORD_CHANNEL_ID?: string; // Optional: Discord channel ID
TWITTER_APPROVAL_CHECK_INTERVAL?: number; // Optional: Approval check interval 
ELEVENLABS_XI_API_KEY?: string; // Optional: ElevenLabs API key
```

## Usage

### Basic Setup
```typescript
import { TwitterManager } from '@elizaos/client-twitter';
const manager = new TwitterManager(runtime, twitterConfig);
// Initialize all components
await manager.client.init();
// Start the posting/interaction loops
await manager.post.start();
await manager.interaction.start();
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
npm test:coverage # Gene


