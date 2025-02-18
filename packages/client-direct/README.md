# Eliza Direct Client API

A REST API service for managing and interacting with Eliza AI agents. This client provides direct HTTP endpoints for agent management, messaging, and various AI capabilities.

## Features

- 🤖 Agent Management (start/stop/list agents)
- 💬 Real-time Messaging
- 🔐 JWT Authentication
- 🎙️ Voice Integration (Whisper & ElevenLabs)
- 📊 Swagger API Documentation
- 🔍 Memory & Log Management
- 🛡️ TEE (Trusted Execution Environment) Logging
- ✅ Verifiable Attestations

## Installation

```bash
npm install @elizaos/client-direct
```


## Configuration

Set the following environment variables:

```env
SERVER_PORT=3000 # API server port
SERVER_URL=http://localhost:3000 # API server URL
EXPRESS_MAX_PAYLOAD=100kb # Max request payload size
JWT_ENABLED=true # Enable JWT authentication
JWT_USERNAME=admin # JWT auth username
JWT_PASSWORD=password # JWT auth password
JWT_SECRET_KEY=your-secret-key # JWT secret key
JWT_EXPIRED=24h # JWT token expiration

#Voice Integration
OPENAI_API_KEY=your-openai-key # For Whisper transcription
ELEVENLABS_XI_API_KEY=your-key # For text-to-speech
ELEVENLABS_VOICE_ID=voice-id # ElevenLabs voice ID
```

## Development
```
# Install dependencies
npm install
# Build the project
npm run build
# Generate Swagger documentation
npm run swagger-autogen
# Start development server
npm run dev
```

## API Endpoints

### Authentication
