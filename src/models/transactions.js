const  mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;

const Schema = new mongoose.Schema(
  {
    user_id: {
      type: ObjectId,
      ref: 'users',
      required: true,
    },
    seller_id: {
      type: ObjectId,
      ref: 'users',
    },
    product_id: {
      type: ObjectId,
      ref: 'products',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    method: { 
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    status: { //pending, success
      type: String,
      required: true,
    },
    transaction_id: {
      type: String,
      required: true,
    },
    transaction_type:  { //credit or debit ( for Admin )
      type: String,
      required: true,
    },
    commission:  { 
      type: Number,
      required: true,
    },
    paidAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("transactions", Schema);
