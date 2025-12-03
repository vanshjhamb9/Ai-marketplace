const express=require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const axios = require('axios');
const WebSocket = require('ws');
const wav = require("node-wav");
const fs = require('fs');

const { CustomError } = require('../../../utils/customError');
const { getSocketIO } = require('../../../config/socket/socket_service');
let socketIo;

const openai = new OpenAI({ apiKey : process.env.OPEN_API_KEY });


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
      "fiction", "non-fiction", "children’s books", "textbooks",
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

const MAX_QUERY_LENGTH = 500; // Adjust based on model's token limits

const systemPrompt = `You are a focused sales assistant helping users buy or sell products.

🎯 Your job:
- Understand the user's intent (buy or sell).
- Ask clear, non-repeating follow-up questions about the product (model, brand, condition, price, etc.).
- These Follow-up questions must be in some priority not random order.
  1. Main Goal → First, ask about the key product needs such as model, brand, condition (new/used), and price range.
  2. Specific Details → Next, ask about important preferences like features, size, color, or style.
  Also don't ask all of these in single go.
- Only ask 1-2 follow-up questions at a time not multiple questions, follow-up question should not be long.
- If the user says single-word-input or short sentence then also ask good follow-up question for that.
- You can ask upto 5-6 follow-up Questions.
- Stay on product-related topics only, If the user asks personal or off-topic questions then Remind them 
  you're a sales assistant within this app and guide back to the product.
- If the user asks about product availability or show me products, Then reply:
  "I'm currently gathering all the necessary product details. Once I have everything, I can show you the best matching products", 
  And guide back to the product.


Categories and Subcategories for any Product must be:
[
  {"category": "Fashion", "subcategories": ["jeans", "shirts", "t-shirts", "polo shirts", "shorts", "jackets", "sweatshirts", "hoodies", "skirts", "dresses", "handbags", "watches", "shoes", "socks", "underwear", "belts", "scarves", "sunglasses"]},
  {"category": "Electronics", "subcategories": ["mobile phones", "laptops", "cameras", "headphones", "smartwatches", "smart speakers", "televisions", "tablets", "wireless earbuds", "routers", "external hard drives", "printers", "monitors", "game consoles"]},
  {"category": "Home & Kitchen", "subcategories": ["cookware", "bedding", "sofas", "dining tables", "small kitchen appliances", "vacuum cleaners", "wall art", "bath towels", "kitchen utensils", "coffee makers", "mattresses", "desk chairs"]},
  {"category": "Beauty & Personal Care", "subcategories": ["skincare", "lipstick", "perfume", "shampoo", "conditioner", "body lotion", "oral care", "makeup brushes", "hair coloring", "face serums", "facial cleansers"]},
  {"category": "Books", "subcategories": ["fiction", "non-fiction", "children’s books", "textbooks", "audiobooks", "ebooks", "comics", "self-help", "cookbooks"]},
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


🔕 Do NOT:
- Say "wait" or "hold on"
- Mention apps or platforms, online or offline. Because platform is this app only.
- Gathering options or display products list.
- Searching, Filtering items, Displaying or Fetching Products.
- Mention city or area.
- Mention "two quick questions 1. 2." and all these kind of things.
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
  {"category": "Books", "subcategories": ["fiction", "non-fiction", "children’s books", "textbooks", "audiobooks", "ebooks", "comics", "self-help", "cookbooks"]},
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

✳️ JSON Format:
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
    It must be benefit‑focused, in natural sentences ( max 100 words). 
    ⚠️ Do NOT include details the user did not respond to.
    ⚠️ Do NOT mention any assistant questions, missing responses, or what was not answered.
    ⚠️ Do NOT say things like “user was asked about...”, “no details were provided”.
  "price": Number // user provided or inferred, 0 if not mentioned
  "category": "main product category", // Only From the categories array mentioned above
  "subcategory": "specific product type",  // Only From the sub-categories array mentioned above
  "task_type": either "buy" or "sell",  // based on user’s intent whether he wants to "buy" or "sell" ,
    bydefault it will be "buy" if not confirmed
}`;
 
const conversationHistory = {};
const streamingHistory = {};
const realTimeSessions = {};
const webSocketInstances = {};

let audioChunks = [];

module.exports = {
    chatAssistant : async(req, res, next)=>{
        try {           
            const { user_query_text } = req.body;
            if(!user_query_text){
                throw new CustomError(400, 'Please send user query');
            }
            const user_id = req.user._id;
            socketIo = getSocketIO();

            if(await isUserWantsToEndChat(user_query_text)){
              const chatEndedSummmary = await getChatEndedSummary(user_id);

              //clearing chat history
              if(conversationHistory[user_id]){  
                conversationHistory[user_id] = null;
              }

              //clearing streaming history
              if(streamingHistory[user_id]){  
                streamingHistory[user_id] = null;
              }

              //closing websocket
              closeWS(user_id);
              realTimeSessions[user_id] = null;

              //sending response to user
              socketIo.to(user_id.toString()).emit('chat_ended', chatEndedSummmary);
            }
            else{
              salesAssistant(user_id, user_query_text)
            }

            return res.status(200).json({
                success: true,
                message: "Success"
            });
        } catch (error) {
            next(error);
        }
    }
}

async function isUserWantsToEndChat(message){
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
    console.error("❌ Failed to detect chat-end message:");
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

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: chatEndedSummarySystemPrompt },
        ...conversationHistory[user_id]
      ],
    });

    const responseText = completion.choices[0].message.content;
    const parsed = JSON.parse(responseText);

    return parsed;
  } catch (err) {
    console.error("❌ Failed to get chat ended summary:");
    throw err;
  }
}

async function salesAssistant(user_id, message) {
  message = message.length > MAX_QUERY_LENGTH ? message.slice(0, MAX_QUERY_LENGTH) : message ;
    
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


  if(!realTimeSessions[user_id]){
    realTimeSessions[user_id] = await createRealtimeSession();
  }
  const wsUrl = realTimeSessions[user_id];

  let ws;
  if(!webSocketInstances[user_id] || webSocketInstances[user_id].readyState != 1){    

    closeWS(user_id);

    ws = new WebSocket(wsUrl, {
      headers: { Authorization: `Bearer ${process.env.OPEN_API_KEY}` }
    });

    webSocketInstances[user_id] = ws;

    if (!ws._listenersAttached) {

      // attach listeners ONCE
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

  console.log(streamingHistory[user_id]);

  const webSocketPayload = {
    type: "response.create",
    response: {
      instructions: systemPrompt,
      input: [
          // {
          //   type: "message",
          //   role: "system",
          //   content: [
          //     {
          //       type: "input_text",
          //       text: systemPrompt
          //     }
          //   ]
          // },
          ...streamingHistory[user_id], 
          // {
          //   type: "message",
          //   role: "user",
          //   content: [
          //     {
          //       type: "input_text",
          //       text: message
          //     }
          //   ]
          // },
      ],
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




//Incoming websocket event handlers
// function closeWS(user_id) {
//   const ws = webSocketInstances[user_id];
//   if (ws) {
//     try {
//       ws.removeAllListeners();  // 🚨 Prevent memory leak
//       ws.terminate();           // 🚨 Hard kill immediately
//     } catch (e) {}
//   }

//   webSocketInstances[user_id] = null;
//   // realTimeSessions[user_id] = null;
// }
function closeWS(user_id) {
  const ws = webSocketInstances[user_id];
  if (ws) {
    try { ws.removeAllListeners(); } catch (e) {}
    try { ws.terminate(); } catch (e) {}
    ws._listenersAttached = false;
  }

  webSocketInstances[user_id] = null;
}
function handleMessage(user_id, data) {
  const msg = JSON.parse(data.toString());

  // AUDIO DELTAS
  if (msg.type === "response.output_audio.delta") {
      console.log('==========audio chunk');

      const base64 = msg.delta;
      const audioBuffer = Buffer.from(base64, "base64");

      // audioChunks.push(audioBuffer);

      //sending audio-chunk to user
      socketIo.to(user_id.toString()).emit('audio_chunk', {audio_base64: base64});
  }
  else if (msg.type === "response.output_audio_transcript.delta") {
      console.log('=======text chunk', msg.delta);

      //sending text-chunk to user
      socketIo.to(user_id.toString()).emit('text_chunk', {text: msg.delta});
  }
  else if(msg.type === 'response.content_part.done'){
      const message = msg.part.transcript;

      //sending full-text message to user
      socketIo.to(user_id.toString()).emit('text_message', {text: message});

      conversationHistory[user_id] = [
          ...conversationHistory[user_id], 
          {role : 'assistant', content : message} 
      ]

      // streamingHistory[user_id] =  [
      //   ...streamingHistory[user_id], 
      //   {
      //     type: "message",
      //     role: "assistant",
      //     content: [{type: "input_text",text: message}]
      //   }
      // ] 
  }
  else if (msg.type === "response.done") {
    console.log("Done.");
    // playAudioChunks();
  }
  
}

//helping functions
async function createRealtimeSession() {
  try {
    const session = await axios.post(
      "https://api.openai.com/v1/realtime/sessions",
      {
        model: "gpt-4o-realtime-preview-2024-12-17",
        modalities: ["text", "audio"],
        voice: "alloy", //'alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', and 'cedar'.
        // the correct key now
        output_audio_format: "pcm16"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPEN_API_KEY}`,
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
function playAudioChunks() {
  const pcm = Buffer.concat(audioChunks);

  // Convert PCM16 → Float32 for high quality WAV
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
  console.log("🔊 Saved clean WAV → output.wav");
}

// 109780621431

