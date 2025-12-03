
const  mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;

const Schema = new mongoose.Schema(
  {
    commission_rate: {
      type: Number,
      required: true,
      default: 2
    },
    description: {
      type: String,
    },
    commission_earned: {
      type: Number,
    },
    support_email: {
      type : String,  
    },
    support_phone_number: { 
        type: Number
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("global_settings", Schema);