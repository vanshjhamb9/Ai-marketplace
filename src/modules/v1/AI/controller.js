const express=require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const axios = require('axios');
const WebSocket = require('ws');
const wav = require("node-wav");
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { CustomError } = require('../../../utils/customError');
const { getSocketIO } = require('../../../config/socket/socket_service');
let socketIo;

let openai = null;
const getOpenAI = () => {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
  if (!openai && apiKey) {
    openai = new OpenAI({ apiKey });
  }
  return openai;
};

const AUDIO_FORMAT = {
  codec: "pcm16",
  sample_rate: 24000,
  channels: 1
};

const streamingState = {};
const clientAckState = {};
const chunkBuffer = {};
const MAX_BUFFER_SIZE = 50;

const categories = [
  {
    "category": "Fashion",
    "subcategories": [
      "jeans", "shirts", "t-shirts", "polo shirts", "shorts",
      "jackets", "sweatshirts", "hoodies", "skirts", "dresses",
      "handbags", "watches", "shoes", "socks", "underwear",
      "belts", "scarves", "sunglasses"
    ]
  },
  {
    "category": "Electronics",
    "subcategories": [
      "mobile phones", "laptops", "cameras", "headphones",
      "smartwatches", "smart speakers", "televisions", "tablets",
      "wireless earbuds", "routers", "external hard drives",
      "printers", "monitors", "game consoles"
    ]
  },
  {
    "category": "Home & Kitchen",
    "subcategories": [
      "cookware", "bedding", "sofas", "dining tables",
      "small kitchen appliances", "vacuum cleaners", "wall art",
      "bath towels", "kitchen utensils", "coffee makers",
      "mattresses", "desk chairs"
    ]
  },
  {
    "category": "Beauty & Personal Care",
    "subcategories": [
      "skincare", "lipstick", "perfume", "shampoo",
      "conditioner", "body lotion", "oral care", "makeup brushes",
      "hair coloring", "face serums", "facial cleansers"
    ]
  },
  {
    "category": "Books",
    "subcategories": [
      "fiction", "non-fiction", "children's books", "textbooks",
      "audiobooks", "ebooks", "comics", "self-help", "cookbooks"
    ]
  },
  {
    "category": "Toys & Games",
    "subcategories": [
      "board games", "puzzles", "action figures", "educational toys",
      "electronic toys", "dolls", "outdoor play", "video games"
    ]
  },
  {
    "category": "Sports & Outdoors",
    "subcategories": [
      "fitness equipment", "camping gear", "cycling",
      "team sports gear", "yoga mats", "running shoes",
      "swimwear", "exercise accessories"
    ]
  },
  {
    "category": "Pet Supplies",
    "subcategories": [
      "dog food", "cat food", "aquatic supplies", "pet grooming tools",
      "pet toys", "pet beds", "bird supplies", "reptile accessories"
    ]
  },
  {
    "category": "Health & Household",
    "subcategories": [
      "vitamins", "supplements", "medical supplies", "cleaning products",
      "personal care essentials", "first aid kits", "nutrition bars"
    ]
  },
  {
    "category": "Tools & Home Improvement",
    "subcategories": [
      "power tools", "hand tools", "hardware", "paint supplies",
      "safety gear", "tool storage", "plumbing tools", "electrical tools"
    ]
  },
  {
    "category": "Industrial & Scientific",
    "subcategories": [
      "lab supplies", "safety equipment", "test & measurement devices",
      "industrial power supplies", "scientific instruments"
    ]
  },
  {
    "category": "Musical Instruments & Video Games",
    "subcategories": [
      "guitars", "keyboards", "drums", "audio interfaces",
      "video games", "game consoles", "PC software"
    ]
  }
]

const MAX_QUERY_LENGTH = 500;
const VOICE_TEMPERATURE = 0.6;

const systemPrompt = `You're a friendly sales assistant. Keep it natural, like chatting with a friend.

Your style:
- Short responses only, 1-2 sentences max.
- Sound human. Use natural pauses with commas, and end thoughts with periods.
- Be warm and conversational, not robotic.
- One question at a time, keep it simple.

Your goal:
- Figure out if they want to buy or sell.
- Ask about the product: brand, model, condition, price range.
- Stay focused on products. If they go off-topic, gently guide them back.

Categories you work with:
Fashion, Electronics, Home & Kitchen, Beauty & Personal Care, Books, Toys & Games, Sports & Outdoors, Pet Supplies, Health & Household, Tools & Home Improvement, Industrial & Scientific, Musical Instruments, Vehicles.

Never:
- Say "wait" or "hold on"
- List multiple questions at once
- Mention other apps or platforms
- Use numbered lists in speech
`;

const chatEndDetectionSystemPrompt = `
You are an AI that detects if a user message ends a conversation. 
Must Reply ONLY as JSON: {"chat_ended": true} or {"chat_ended": false}. 
Do not add any extra text.
`;

const chatEndedSummarySystemPrompt = `
You are a focused sales assistant helping users buy or sell Products.
Your goal is to analyze and Summarize the chat conversation.

Categories and Subcategories for any Product must be:
[
  {"category": "Fashion", "subcategories": ["jeans", "shirts", "t-shirts", "polo shirts", "shorts", "jackets", "sweatshirts", "hoodies", "skirts", "dresses", "handbags", "watches", "shoes", "socks", "underwear", "belts", "scarves", "sunglasses"]},
  {"category": "Electronics", "subcategories": ["mobile phones", "laptops", "cameras", "headphones", "smartwatches", "smart speakers", "televisions", "tablets", "wireless earbuds", "routers", "external hard drives", "printers", "monitors", "game consoles"]},
  {"category": "Home & Kitchen", "subcategories": ["cookware", "bedding", "sofas", "dining tables", "small kitchen appliances", "vacuum cleaners", "wall art", "bath towels", "kitchen utensils", "coffee makers", "mattresses", "desk chairs"]},
  {"category": "Beauty & Personal Care", "subcategories": ["skincare", "lipstick", "perfume", "shampoo", "conditioner", "body lotion", "oral care", "makeup brushes", "hair coloring", "face serums", "facial cleansers"]},
  {"category": "Books", "subcategories": ["fiction", "non-fiction", "children's books", "textbooks", "audiobooks", "ebooks", "comics", "self-help", "cookbooks"]},
  {"category": "Toys & Games", "subcategories": ["board games", "puzzles", "action figures", "educational toys", "electronic toys", "dolls", "outdoor play", "video games"]},
  {"category": "Sports & Outdoors", "subcategories": ["fitness equipment", "camping gear", "cycling", "team sports gear", "yoga mats", "running shoes", "swimwear", "exercise accessories"]},
  {"category": "Pet Supplies", "subcategories": ["dog food", "cat food", "aquatic supplies", "pet grooming tools", "pet toys", "pet beds", "bird supplies", "reptile accessories"]},
  {"category": "Health & Household", "subcategories": ["vitamins", "supplements", "medical supplies", "cleaning products", "personal care essentials", "first aid kits", "nutrition bars"]},
  {"category": "Tools & Home Improvement", "subcategories": ["power tools", "hand tools", "hardware", "paint supplies", "safety gear", "tool storage", "plumbing tools", "electrical tools"]},
  {"category": "Industrial & Scientific", "subcategories": ["lab supplies", "safety equipment", "test & measurement devices", "industrial power supplies", "scientific instruments"]},
  {"category": "Musical Instruments & Video Games", "subcategories": ["guitars", "keyboards", "drums", "audio interfaces", "video games", "game consoles", "PC software"]},
  {"category": "Vehicles", "subcategories": ["cars", "bikes", "scooters", "trucks", "buses", "electric vehicles", "hybrid vehicles", "vans", "tractors", "rvs & campers", "commercial vehicles", "auto parts & accessories"]}
] 
You will only use these categories and subcategories.

Summarize the chat conversation with the product intent.
Respond ONLY with the raw plain JSON object.

JSON Format:
You MUST Return ONLY the raw JSON Plain Object. Do NOT include any extra text, explanation, or formatting before or after.
{
  "title": "",
  "description": "",
  "price": "",
  "category": "",
  "subcategory": "",
  "task_type": ""
}

JSON Fields Explaination
{
  "title": Short, Focused product title of the entire conversation, 
    It can't be empty, whether user input very less details
  "description": A concise summary **ONLY of the information provided by the user** during the chat. 
    It must be benefit-focused, in natural sentences ( max 100 words). 
    Do NOT include details the user did not respond to.
    Do NOT mention any assistant questions, missing responses, or what was not answered.
    Do NOT say things like "user was asked about...", "no details were provided".
  "price": Number // user provided or inferred, 0 if not mentioned
  "category": "main product category", // Only From the categories array mentioned above
  "subcategory": "specific product type",  // Only From the sub-categories array mentioned above
  "task_type": either "buy" or "sell",  // based on user's intent whether he wants to "buy" or "sell" ,
    bydefault it will be "buy" if not confirmed
}`;
 
const conversationHistory = {};
const streamingHistory = {};
const realTimeSessions = {};
const webSocketInstances = {};
const audioChunksHistory = {};
const sessionWarmingPromises = {};

let audioChunks = [];

const chatAssistant = async(req, res, next)=>{
    try {           
        const { user_query_text } = req.body;
        if(!user_query_text){
            throw new CustomError(400, 'Please send user query');
        }

        const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
        if (!apiKey) {
            throw new CustomError(500, 'OpenAI API key not configured. Please add OPENAI_API_KEY to your secrets.');
        }

        const user_id = req.user._id;
        socketIo = getSocketIO();

        res.status(200).json({
            success: true,
            message: "Success"
        });

        const shouldEndChat = await isUserWantsToEndChat(user_query_text);
        
        if(shouldEndChat){
          const chatEndedSummary = await getChatEndedSummary(user_id);
          
          closeWS(user_id);
          clearRealTimeSessions(user_id);
          clearChatHistory(user_id);

          socketIo.to(user_id.toString()).emit('chat_ended', chatEndedSummary);
        } else {
          salesAssistant(user_id, user_query_text);
        }

    } catch (error) {
        console.log(error, '--------error in chat bot api');
        next(error);
    }
}

async function prewarmSession(user_id) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
  if (!apiKey) {
    console.log('Cannot prewarm: OPENAI_API_KEY not set');
    return;
  }
  
  if (sessionWarmingPromises[user_id]) {
    return sessionWarmingPromises[user_id];
  }
  
  if (realTimeSessions[user_id]) {
    return realTimeSessions[user_id];
  }
  
  console.log(`Pre-warming session for user: ${user_id}`);
  
  sessionWarmingPromises[user_id] = createRealtimeSession()
    .then(wsUrl => {
      realTimeSessions[user_id] = wsUrl;
      delete sessionWarmingPromises[user_id];
      console.log(`Session pre-warmed for user: ${user_id}`);
      return wsUrl;
    })
    .catch(err => {
      delete sessionWarmingPromises[user_id];
      console.error(`Failed to prewarm session for ${user_id}:`, err.message);
      return null;
    });
  
  return sessionWarmingPromises[user_id];
}

const testChatAssistant = async(req, res, next)=>{
    try {           
        const { user_query_text, user_id } = req.body;
        if(!user_query_text){
            throw new CustomError(400, 'Please send user query');
        }

        const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
        if (!apiKey) {
            throw new CustomError(500, 'OpenAI API key not configured. Please add OPENAI_API_KEY to your secrets.');
        }

        const testUserId = user_id || 'test-user';
        socketIo = getSocketIO();

        res.status(200).json({
            success: true,
            message: "Success"
        });

        const shouldEndChat = await isUserWantsToEndChat(user_query_text);
        
        if(shouldEndChat){
          const chatEndedSummary = await getChatEndedSummary(testUserId);
          
          closeWS(testUserId);
          clearRealTimeSessions(testUserId);
          clearChatHistory(testUserId);

          socketIo.to(testUserId.toString()).emit('chat_ended', chatEndedSummary);
        } else {
          salesAssistant(testUserId, user_query_text);
        }

    } catch (error) {
        console.log(error, '--------error in test chat bot api');
        next(error);
    }
}

module.exports = {
   chatAssistant,
   testChatAssistant,
   setupAudioAckListener,
   closeWS,
   clearRealTimeSessions,
   clearChatHistory,
   prewarmSession
}


async function isUserWantsToEndChat(message){
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: process.env.OPEN_API_GPT_4o_MINI_MODEL,
      temperature: VOICE_TEMPERATURE,
      messages: [
        { role: "system", content: chatEndDetectionSystemPrompt },
        { role: "user", content: `Message: "${message}"` }
      ],
    });

    const responseText = completion.choices[0].message.content;
    const parsed = JSON.parse(responseText);
    console.log(parsed, '========end detection');
    return parsed.chat_ended;
  } catch (err) {
    console.error("Failed to detect chat-end message:");
    throw err;
  }
}

async function getChatEndedSummary(user_id){
   try {

    if(!conversationHistory[user_id]){
      return {
        "title": "",
        "description": "",
        "price": "",
        "category": "",
        "subcategory": "",
        "task_type": ""
      }
    }

    const completion = await getOpenAI().chat.completions.create({
      model: process.env.OPEN_API_GPT_5_MINI_MODEL,
      temperature: VOICE_TEMPERATURE,
      messages: [
        { role: "system", content: chatEndedSummarySystemPrompt },
        ...conversationHistory[user_id]
      ],
    });

    const responseText = completion.choices[0].message.content;
    const parsed = JSON.parse(responseText);

    return parsed;
  } catch (err) {
    console.error("Failed to get chat ended summary:", err);
    throw err;
  }
}

async function salesAssistant(user_id, message) {
  message = message.length > MAX_QUERY_LENGTH ? message.slice(0, MAX_QUERY_LENGTH) : message ;
  
  const turnId = uuidv4();
  
  initializeStreamingState(user_id, turnId);
    
  conversationHistory[user_id] = !conversationHistory[user_id]
      ?   [ {role : 'user', content : message} ]
      :   [
              ...conversationHistory[user_id], 
              {role : 'user', content : message} 
          ]

  streamingHistory[user_id] = !streamingHistory[user_id]
      ?   
        [{
          type: "message",
          role: "user",
          content: [{type: "input_text",text: message}]
        }]
      :
        [
          ...streamingHistory[user_id], 
          {
            type: "message",
            role: "user",
            content: [{type: "input_text",text: message}]
          }
        ] 


  if(sessionWarmingPromises[user_id]){
    await sessionWarmingPromises[user_id];
  }

  if(!realTimeSessions[user_id]){
    realTimeSessions[user_id] = await createRealtimeSession();
  }
  const wsUrl = realTimeSessions[user_id];

  let ws;
  if(!webSocketInstances[user_id] || webSocketInstances[user_id].readyState !== 1){    

    closeWS(user_id);

    const wsApiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
    ws = new WebSocket(wsUrl, {
      headers: { Authorization: `Bearer ${wsApiKey}` }
    });

    webSocketInstances[user_id] = ws;

    if (!ws._listenersAttached) {

      ws.on("open", () => {
        console.log("===== WebSocket Connected");

        ws.send(JSON.stringify({
          type: "response.create",
          response: {
            instructions: systemPrompt
          }
        }));

      });

      ws.on("message", (data) => handleMessage(user_id, data));
      ws.on("close", () => closeWS(user_id));
      ws.on("error", () => closeWS(user_id));

      ws._listenersAttached = true;
    }

  }else{
    ws = webSocketInstances[user_id];
  }
  
  console.log(ws.readyState, '==========ws');

  const webSocketPayload = {
    type: "response.create",
    response: {
      instructions: systemPrompt,
      input: streamingHistory[user_id],
      output_modalities: ["audio"]
    }
  }

  if(ws.readyState == 0){
    ws.once("open", () => {
      console.log('=====> OpenAI Websocket Connected');
      ws.send(JSON.stringify(webSocketPayload));
    });
  }
  else{
    ws.send(JSON.stringify(webSocketPayload));
  }
 
}

function initializeStreamingState(user_id, turnId) {
  streamingState[user_id] = {
    turnId: turnId,
    seq: 0,
    streamStarted: false
  };
  
  clientAckState[user_id] = {
    lastAckedSeq: -1
  };
  
  chunkBuffer[user_id] = [];
}

function handleMessage(user_id, data) {
  const msg = JSON.parse(data.toString());
  console.log(msg.type, '======message type');

  if (msg.type === "response.output_audio.delta") {
      const base64 = msg.delta;
      const state = streamingState[user_id];
      
      if (!state) {
        console.error('No streaming state found for user:', user_id);
        return;
      }
      
      if (!state.streamStarted) {
        state.streamStarted = true;
        socketIo.to(user_id.toString()).emit('stream_start', {
          turnId: state.turnId,
          format: AUDIO_FORMAT
        });
      }
      
      const seq = state.seq++;
      
      const chunkPayload = {
        seq: seq,
        turnId: state.turnId,
        format: AUDIO_FORMAT,
        chunk: base64,
        is_last: false
      };
      
      const ackState = clientAckState[user_id];
      const buffer = chunkBuffer[user_id];
      
      if (ackState && (seq - ackState.lastAckedSeq) > MAX_BUFFER_SIZE) {
        buffer.push(chunkPayload);
        console.log(`Buffering chunk ${seq} - client behind at seq ${ackState.lastAckedSeq}`);
      } else {
        socketIo.to(user_id.toString()).emit('audio_chunk', chunkPayload);
        
        flushBuffer(user_id);
      }
  }
  else if (msg.type === "response.output_audio_transcript.delta") {
      socketIo.to(user_id.toString()).emit('text_chunk', {text: msg.delta});
  }
  else if(msg.type === 'response.content_part.done'){
      const message = msg.part.transcript;
      const state = streamingState[user_id];

      if (state) {
        const finalSeq = state.seq++;
        socketIo.to(user_id.toString()).emit('audio_chunk', {
          seq: finalSeq,
          turnId: state.turnId,
          format: AUDIO_FORMAT,
          chunk: null,
          is_last: true
        });
        
        socketIo.to(user_id.toString()).emit('stream_end', {
          turnId: state.turnId,
          totalChunks: finalSeq + 1
        });
      }

      socketIo.to(user_id.toString()).emit('text_message', {text: message});

      conversationHistory[user_id] = [
          ...conversationHistory[user_id], 
          {role : 'assistant', content : message} 
      ]
  }
  else if (msg.type === "response.done") {
    console.log("Done.");
  }
  
}

function flushBuffer(user_id) {
  const buffer = chunkBuffer[user_id];
  const ackState = clientAckState[user_id];
  
  if (!buffer || !ackState || buffer.length === 0) return;
  
  while (buffer.length > 0) {
    const chunk = buffer[0];
    if ((chunk.seq - ackState.lastAckedSeq) <= MAX_BUFFER_SIZE) {
      buffer.shift();
      socketIo.to(user_id.toString()).emit('audio_chunk', chunk);
    } else {
      break;
    }
  }
}

function handleAudioAck(user_id, ackData) {
  const { highestSeqPlayed } = ackData;
  
  if (clientAckState[user_id]) {
    clientAckState[user_id].lastAckedSeq = highestSeqPlayed;
    
    flushBuffer(user_id);
  }
}

function setupAudioAckListener(socket, user_id) {
  socket.on('audio_ack', (data) => {
    handleAudioAck(user_id, data);
  });
}

async function createRealtimeSession() {
  try {
    const session = await axios.post(
      "https://api.openai.com/v1/realtime/sessions",
      {
        model: process.env.OPEN_API_REALTIME_MODEL,
        modalities: ["text", "audio"],
        voice: "alloy",
        output_audio_format: "pcm16",
        temperature: VOICE_TEMPERATURE
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY}`,
          "Content-Type": "application/json",
        }
      }
    );

    const clientSecret = session.data.client_secret.value;

    const wsUrl =
      `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17` +
      `&client_secret=${clientSecret}`;

    console.log("WS:", wsUrl);
    return wsUrl;
  } catch (err) {
    console.log("Session error:", err.response?.data || err);
    throw err;
  }
}

function closeWS(user_id) {
  const ws = webSocketInstances[user_id];

  if (ws) {
    try { ws.removeAllListeners(); } catch (e) {}
    try { ws.terminate(); } catch (e) {}

    ws._listenersAttached = false;
    webSocketInstances[user_id] = null;
  }
}

function clearRealTimeSessions(user_id){
  if(realTimeSessions[user_id]){
    realTimeSessions[user_id] = null;
  }
}

function clearChatHistory(user_id){
  if(conversationHistory[user_id]){  
    conversationHistory[user_id] = null;
  }

  if(streamingHistory[user_id]){  
    streamingHistory[user_id] = null;
  }

  if(audioChunksHistory[user_id]){
    audioChunksHistory[user_id] = null;
  }
  
  if(streamingState[user_id]){
    streamingState[user_id] = null;
  }
  
  if(clientAckState[user_id]){
    clientAckState[user_id] = null;
  }
  
  if(chunkBuffer[user_id]){
    chunkBuffer[user_id] = null;
  }
}


function playAudioChunks() {
  const pcm = Buffer.concat(audioChunks);

  const sampleCount = pcm.length / 2;
  const float32 = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    float32[i] = pcm.readInt16LE(i * 2) / 32768;
  }

  const wavData = wav.encode([float32], {
    sampleRate: 24000,
    float: true,
    bitDepth: 32,
  });

  fs.writeFileSync("output.wav", wavData);
  console.log("Saved clean WAV -> output.wav");
}
