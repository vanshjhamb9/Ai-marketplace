# AI Marketplace - Voice Assistant Backend

## Overview
An AI-powered voice assistant chatbot backend for a marketplace platform where users can create tasks as buyers or sellers. Features real-time voice streaming with OpenAI's Realtime API, optimized audio playback, and a beautiful Siri-like web interface for testing.

## Recent Changes (December 2024)
- **Session Pre-warming**: OpenAI realtime session is created when user connects (saves 500-1000ms on first response)
- **Gapless Audio Playback**: Continuous audio scheduling for smooth, uninterrupted speech
- **Reduced Buffer Threshold**: Audio starts playing immediately with first chunk (was 3, now 1)
- **Faster Playback Loop**: Reduced delays from 50ms to 5-10ms for quicker response
- Optimized voice streaming with sequence numbers and backpressure control
- Added Siri-like web frontend for testing voice assistant
- Improved system prompts for more natural, human-like responses
- Made server resilient to missing API keys (graceful degradation)
- Fixed audio chunking and playback synchronization

## Project Architecture

### Tech Stack
- **Runtime**: Node.js 20
- **Framework**: Express.js 5
- **Database**: MongoDB (via Mongoose)
- **Real-time**: Socket.IO
- **AI**: OpenAI Realtime API (gpt-4o-realtime-preview)
- **File Storage**: Cloudinary
- **Email**: SendGrid

### Directory Structure
```
├── index.js                 # Main entry point, Express server setup
├── client/                  # Siri-like voice assistant web UI
│   ├── index.html           # Main HTML with orb button and chat UI
│   ├── styles.css           # Dark theme with animations
│   └── app.js               # Socket.IO and Web Audio API integration
├── src/
│   ├── config/
│   │   ├── socket/          # Socket.IO configuration
│   │   │   ├── socket.js    # Socket server initialization
│   │   │   └── socket_service.js  # Socket event handlers
│   │   └── sendgrid.js      # SendGrid email configuration
│   ├── middlewares/
│   │   ├── errorMiddleware.js     # Global error handler
│   │   └── isLoggedInMiddleware.js # JWT authentication
│   ├── models/              # Mongoose schemas
│   │   ├── users.js
│   │   ├── products.js
│   │   ├── transactions.js
│   │   ├── messages.js
│   │   ├── chat_rooms.js
│   │   └── global_settings.js
│   ├── modules/v1/          # API routes by feature
│   │   ├── AI/              # AI voice assistant endpoints
│   │   ├── auth/            # Authentication
│   │   ├── user/            # User profile
│   │   ├── products/        # Products CRUD
│   │   ├── transactions/    # Transactions
│   │   └── messages/        # Chat messages
│   ├── public/uploads/      # File uploads directory
│   └── utils/
│       ├── helperFunctions.js  # JWT, email utilities
│       ├── customError.js      # Custom error class
│       └── cron.js             # Scheduled tasks
```

## Socket Events (Voice Streaming Protocol)

### Client → Server
- `createRoom`: Join a room with `{roomId: userId}`
- `audio_ack`: Acknowledge played audio `{highestSeqPlayed: number}`

### Server → Client
- `stream_start`: Streaming begins `{turnId, format: {codec, sample_rate, channels}}`
- `audio_chunk`: Audio data `{seq, turnId, format, chunk: base64, is_last: bool}`
- `text_chunk`: Text fragment `{text, seq}`
- `text_message`: Complete text `{text}`
- `stream_end`: Streaming complete `{turnId, totalChunks}`
- `chat_ended`: Conversation summary with product details

### Audio Format
- Codec: PCM16
- Sample Rate: 24000 Hz
- Channels: 1 (mono)

## Environment Variables

### Required for Full Functionality
- `PORT`: Server port (default: 5000)
- `MONGO_CONNECTION_STRING`: MongoDB connection URI
- `JWT_SECRET_KEY`: Secret for JWT token signing
- `OPEN_API_KEY`: OpenAI API key

### Optional
- `SENDGRID_API_KEY`: For email functionality
- `SENDER_EMAIL`: Email sender address
- `CLOUDINARY_CLOUD_NAME`: Cloudinary cloud name
- `CLOUDINARY_API_KEY`: Cloudinary API key
- `CLOUDINARY_API_SECRET`: Cloudinary API secret
- `VOYAGE_API_KEY`: VoyageAI API key for embeddings

### Model Configuration
- `OPEN_API_MODEL`: Main model (default: gpt-4o)
- `OPEN_API_GPT_4o_MINI_MODEL`: Mini model (default: gpt-4o-mini)
- `OPEN_API_REALTIME_MODEL`: Realtime model (default: gpt-4o-realtime-preview)

## Running the Project

### Development
```bash
npm install
npm start
```

The server starts on port 5000 and serves the voice assistant UI at the root path `/`.

### Health Check
GET `/health` - Returns `{success: true}`

## Voice Assistant Improvements Made

### Performance Optimizations
1. **Sequence Numbers**: Each audio chunk now includes a sequence number for proper ordering
2. **Backpressure Control**: Server waits for client acknowledgment before sending more chunks
3. **Stream Events**: Added `stream_start` and `stream_end` events for better lifecycle management
4. **Lazy API Initialization**: OpenAI client only initializes when API key is available

### Human-like Behavior
1. **Shorter Responses**: AI now gives 1-2 sentence responses
2. **Natural Speech**: Prompts encourage conversational tone with natural pauses
3. **Lower Temperature**: Set to 0.6 for more consistent, natural responses

### Frontend Features
1. **Siri-like UI**: Beautiful dark gradient background with glowing orb
2. **Audio Buffering**: Web Audio API with proper PCM16 decoding
3. **Live Transcript**: Real-time text display during streaming
4. **Visual Feedback**: Animated states (Ready, Thinking, Speaking)

## User Preferences
- Keep responses short and conversational
- Focus on performance and low latency
- Maintain backwards compatibility with Flutter app
