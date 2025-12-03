require('dotenv').config();
const express=require('express');
const app=express();
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const { errorMiddleware } = require('./src/middlewares/errorMiddleware');
const { initializeSocketServer } = require('./src/config/socket/socket');
const { queryObjects } = require('v8');
const { SocketAddress } = require('net');
const { RoomRecordingPage } = require('twilio/lib/rest/video/v1/room/roomRecording');

app.use(cors('*'));
app.use(express.json());
app.use(express.urlencoded({extended:true}));

// app.use(express.static(path.join(__dirname, 'src', 'public')))
// app.use(fileUpload());
// Middleware
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/', // required for cloudinary file handling
}));

app.use(express.static(path.join(__dirname, 'client')));

app.get('/health',(req,res)=>{
    res.status(200).send({success:true});
})

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

app.use('/webservice/api', require('./src/routes'));
app.use(errorMiddleware);

const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

async function startServer() {
    let mongoConnected = false;
    
    if (process.env.MONGO_CONNECTION_STRING) {
        try {
            await mongoose.connect(process.env.MONGO_CONNECTION_STRING);
            console.log('MongoDB connected');
            mongoConnected = true;
        } catch (error) {
            console.log('Warning: MongoDB connection failed -', error.message);
            console.log('Server will start without database connectivity');
        }
    } else {
        console.log('Warning: MONGO_CONNECTION_STRING not set. Server will start without database connectivity.');
    }
    
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running at port: ${PORT}`);
        
        initializeSocketServer(server);
        
        if (mongoConnected) {
            require('./src/utils/cron');
        }
        
        if (!mongoConnected) {
            console.log('Note: API endpoints requiring database will not work until MongoDB is connected.');
        }
    });
}

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});

//=================to generate jwt tokens
// const secret = crypto.randomBytes(64).toString("hex"); // 512-bit secret
// console.log(jwt.sign({name:'mayank'}, secret, {expiresIn: '30d'}));

// const helperFunctions = require('./src/utils/helperFunctions');
// helperFunctions.sendOTP('+918000727389', '12111');




// 1. Install Winston:
// npm install winston

// 2. Basic Setup:
// // logger.js
// const winston = require('winston');

// const logger = winston.createLogger({
//   level: 'info', // 'error', 'warn', 'info', 'debug'
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.printf(({ timestamp, level, message }) => {
//       return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
//     })
//   ),
//   transports: [
//     new winston.transports.Console(), // Log to console
//     new winston.transports.File({ filename: 'error.log', level: 'error' }) // Save errors to file
//   ]
// });

// module.exports = logger;

// 3. Use It in Your App:
// const logger = require('./logger');

// // Example error logging
// try {
//   throw new Error('Something went wrong');
// } catch (err) {
//   logger.error(`Caught error: ${err.message}`);
// }

// 📄 You can log other levels too:
// logger.info('Server started on port 4000');
// logger.warn('Something might be off');
// logger.debug('Debugging details');

// 🛠️ Tip: Centralized Error Middleware (for Express apps)
// app.use((err, req, res, next) => {
//   logger.error(`${req.method} ${req.url} - ${err.message}`);
//   res.status(500).json({ error: 'Internal Server Error' });
// });


//Streaming audio and text
// Frontend will hit the regular api to send the user query
// Backend will send the data in chunks to frontend using Sockets

// User will join a room using user_id before start the chatting 

// =====> Socket events
// 1.  "createRoom" to join a room and paas user_id inside roomId
// 2. "audio_chunk" you will get {audio_base64} chunk until the streaming completes (means u will get data in packets)
// 3. "text_chunk" you will get {text} chunk 
// 4. "text_message" you will get full text at the end
// 5. "chat_ended" when chat will be ended then you will get a json in this