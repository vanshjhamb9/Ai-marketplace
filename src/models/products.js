
const  mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;

const Schema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    task_type: { //buy or sell
      type : String,
      required : true
    },
    category: {
      type : String,
      required : true
    },
    subcategory: {
      type : String,
      required : true
    },
    status:{ //active, closed or expired
      type: String,
      default: 'active',
    },
    purchased_by : {
      type : ObjectId,
      ref :  'users',
    },
    created_by : {
      type : ObjectId,
      ref :  'users',
      required : true,
    },
    images : {
        type : Array,
        default : []
    },
    embedding : [Number], //It will contain embeddings of 1024 dimensions using voyage model
    location: { type: Object }
  },
  { timestamps: true }
);

module.exports = mongoose.model("products", Schema);