// In your ./models/user.js file:
import mongoose from "mongoose";
const User = mongoose.model("User", userSchema);

// 👇️ Change your export line to this:
export default User;
const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const userModel = mongoose.model("User", userSchema);
module.exports = userModel;
