const  mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    otp: {
      type: Number,
    //   required: true,
    },
    otp_expiry_time: {
      type: Date,
    //   required: true,
    },
    otp_check_remaining_limit: {
      type: Number,
    //   required: true,
    },
    otp_type : {
      type  : String, //logged_in, forgot_password
    },
    access_token: {
      type: String,
    //   required: true,
    },
    full_address: {
      type: String,
    //   required: true,
    },
    bank_account_number: {
      type: String,
    //   required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("users", UserSchema);
