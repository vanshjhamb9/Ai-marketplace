# AI Marketplace Backend

## Overview
An AI-powered voice assistant chatbot backend for a marketplace platform where users can create tasks as buyers or sellers. Built with Node.js/Express, MongoDB, Socket.IO for real-time communication, and integrates with OpenAI for AI features.

## Project Architecture

### Tech Stack
- **Runtime**: Node.js 20
- **Framework**: Express.js 5
- **Database**: MongoDB (via Mongoose)
- **Real-time**: Socket.IO
- **AI**: OpenAI API
- **File Storage**: Cloudinary
- **Email**: SendGrid
- **SMS**: Twilio (optional)

### Directory Structure
```
├── index.js                 # Main entry point, Express server setup
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
│   │   ├── auth/            # Authentication (login, register, OTP)
│   │   ├── user/            # User profile management
│   │   ├── products/        # Product CRUD
│   │   ├── transactions/    # Transaction handling
│   │   └── messages/        # Chat messages
│   ├── public/uploads/      # File uploads directory
│   ├── utils/
│   │   ├── helperFunctions.js  # JWT, email, SMS utilities
│   │   ├── customError.js      # Custom error class
│   │   └── cron.js             # Scheduled tasks
│   └── routes.js            # Main route aggregator
├── package.json
└── vercel.json              # Vercel deployment config
```

### API Base Path
All API routes are prefixed with `/webservice/api`

### Socket Events
- `createRoom`: Join a room with user_id
- `audio_chunk`: Receive audio data in base64 chunks
- `text_chunk`: Receive text chunks during streaming
- `text_message`: Receive full text at end
- `chat_ended`: Chat session completed

## Environment Variables

### Required
- `PORT`: Server port (default: 3000)
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
- `TWILIO_ACCOUNT_SID`: Twilio account SID
- `TWILIO_AUTH_TOKEN`: Twilio auth token
- `TWILIO_MESSAGING_SERVICE_SID`: Twilio messaging service ID

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

### Health Check
GET `/health` - Returns `{success: true}` when server is running

## Known Issues & Improvements Needed

### Voice Assistant Performance
1. **Latency**: Current implementation waits for full LLM response before TTS
2. **Audio Streaming**: Needs sequence numbers and proper chunking
3. **Flutter Integration**: Audio playback sync issues

See the improvement plan in project notes.

## Recent Changes
- December 2024: Imported to Replit, configured environment
