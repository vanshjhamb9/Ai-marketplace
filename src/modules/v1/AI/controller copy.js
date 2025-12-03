const express=require('express');
const router = express.Router();
const { OpenAI } = require('openai');

const { CustomError } = require('../../../utils/customError');
const { getSocketIO } = require('../../../config/socket/socket_service');

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
- Mention apps or platforms. Because platform is this app only.
- Gathering options or display products list.
- Searching, Filtering items, Displaying or Fetching Products.
- Mention city or area.
- Mention "two quick questions 1. 2." and all these kind of things.

✅ Ending the Chat:
Don't end the chat immediately until user says.
If the user says they are done or wants to end the conversation (even after just one message), summarize the conversation and return a JSON object with the product intent.
You can also end the chat if you think you have gathered the enough and necessary details or the chat is not attractive.
⚠️ Important:
-When the chat ends, respond ONLY with the raw plain JSON object.
- In JSON object, "description" field must not contain like "user not provided these or these things".

✳️ JSON Format:
You MUST Return ONLY the raw JSON Plain Object when chat ends. Do NOT include any extra text, explanation, or formatting before or after.
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
  "task_type": either "buy" or "sell",  // based on user’s intent, bydefault it will be "buy" if not confirmed
  "chat_ended": true
}
`;
 
const conversationHistory = {};

module.exports = {
    getQueryInfo : async(req, res, next)=>{
        try {           
            const { user_query_text } = req.body;
            if(!user_query_text){
                throw new CustomError(400, 'Please send user query');
            }
            const user_id = req.user._id;

            // const ttsResponse = await getOpenAIData(user_id, user_query_text);

            // if(ttsResponse){
            //   res.setHeader("Content-Type", "audio/mpeg");
            //   return ttsResponse.body.pipe(res);
            // }

            // // NO TTS → TEXT/JSON RESPONSE MODE
            // return res.status(200).json({
            //     success: true,
            //     data: null,
            //     message: "No TTS available for this response"
            // });

            const data = await getOpenAIData(user_id, user_query_text);

            // NO TTS → TEXT/JSON RESPONSE MODE
            return res.status(200).json({
                success: true,
                data,
                message: "Success"
            });
        } catch (error) {
            next(error);
        }
    }
}

async function getOpenAIData(user_id, user_query_text){

    const cleanedUserQuery = user_query_text.length > MAX_QUERY_LENGTH ? user_query_text.slice(0, MAX_QUERY_LENGTH) : user_query_text ;
    
    conversationHistory[user_id] = !conversationHistory[user_id]
        ?   [ {role : 'user', content : cleanedUserQuery} ]
        :   [
                ...conversationHistory[user_id], 
                {role : 'user', content : cleanedUserQuery} 
            ] 
  

    try {
        //responses
        // const chatCompletion = await openai.chat.completions.create({
        //     model : process.env.OPEN_API_MODEL,
        //     messages : [
        //         { role: 'system', content: systemPrompt },
        //         ...conversationHistory[user_id]
        //     ]
        // })
        
        // let AIResponse = chatCompletion.choices[0].message.content;

        const response = await openai.responses.create({
          // model: "gpt-4o-realtime-preview-2024-12-17",
          model: "gpt-4o-mini-tts",
          audio: {
            voice: "alloy",
            format: "mp3",
          },
          input: [
            { role: 'system', content: systemPrompt },
            ...conversationHistory[user_id]
          ]
        })
        const content = response.output[0].content;

        let assistantText;
        let assistantAudio;
        for(const item of content){
          if(item.type == 'output_text'){
            assistantText += item.text;
          }
          if (item.type === "output_audio") {
            assistantAudio = item.audio_data;
            // assistantAudio = Buffer.from(item.audio.data, "base64");
          }
          // else{
          //   assistantAudio = item.audio;
          // }
        }
        // console.log(AIResponse);

        let data;

        if(assistantText.includes('chat_ended')){
            assistantText = JSON.parse(assistantText);
            delete assistantText.chat_ended;
            data = {
                response : assistantText,
                is_conversation_end : true
            }

            delete conversationHistory[user_id];
        }else{
            data = {
                response : assistantText,
                audio: assistantAudio,
                is_conversation_end : false,
            }

            conversationHistory[user_id].push({
                role : 'assistant',
                content : assistantText
            })
        }

        //send voice using api-response
        return data;
    } catch (error) {
        console.log('Error : ', error);
        throw error;
    }
}

// async function getOpenAIData(user_id, user_query_text){

//     const cleanedUserQuery = user_query_text.length > MAX_QUERY_LENGTH ? user_query_text.slice(0, MAX_QUERY_LENGTH) : user_query_text ;
    
//     conversationHistory[user_id] = !conversationHistory[user_id]
//         ?   [ {role : 'user', content : cleanedUserQuery} ]
//         :   [
//                 ...conversationHistory[user_id], 
//                 {role : 'user', content : cleanedUserQuery} 
//             ] 
  

//     try {
//         //responses
//         const chatCompletion = await openai.chat.completions.create({
//             model : process.env.OPEN_API_MODEL,
//             messages : [
//                 { role: 'system', content: systemPrompt },
//                 ...conversationHistory[user_id]
//             ]
//         })
        
//         let AIResponse = chatCompletion.choices[0].message.content;
//         // console.log(AIResponse);

//         let data;
//         let ttsResponse;
//         if(AIResponse.includes('chat_ended')){
//             AIResponse = JSON.parse(AIResponse);
//             delete AIResponse.chat_ended;
//             data = {
//                 response : AIResponse,
//                 is_conversation_end : true
//             }

//             delete conversationHistory[user_id];
//         }else{
//             data = {
//                 response : AIResponse,
//                 is_conversation_end : false
//             }

//             // 3️⃣ Create TTS audio stream and pipe directly to response
//             ttsResponse = await openai.audio.speech.create({
//               model: "gpt-4o-mini-tts",
//               voice: "alloy",
//               input: AIResponse,
//               format: "mp3",
//             });

//             conversationHistory[user_id].push({
//                 role : 'assistant',
//                 content : AIResponse
//             })
//         }

//         //send AI-response using socket
//         const socketIO = getSocketIO();
//         socketIO.to(user_id).emit("getMessage", data);

//         //send voice using api-response
//         return ttsResponse;
//     } catch (error) {
//         console.log('Error : ', error);
//         throw error;
//     }
// }

// 109780621431

