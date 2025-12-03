
const  mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;

const Schema = new mongoose.Schema(
  {
    sender: {
      type: ObjectId,
      ref: 'users',
      required: true,
    },
    receiver: {
      type: ObjectId,
      ref: 'users',
      required: true,
    },
    message_type: {
      type: String, //text, voice, media(image, document and pdf) or offer
      required: true,
    },

    text_message: {
      type : String,  
    },

    voice_duration: { //in seconds
        type: Number
    },
    voice_status: { //missed, recieved
        type: String
    },

    media_list: { //if we are attaching any media inside the chat
        type: Array
    },
    
    offered_price: {
      type: Number
    },
    offer_status: { //pending, accepted or rejected
      type: String
    },
    offered_by: { //who will generate, accept or reject
      type: ObjectId,
      ref: 'users',
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("messages", Schema);