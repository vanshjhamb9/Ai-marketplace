
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("chat_rooms", Schema);