import mongoose from "mongoose";

// STEP 1: DEFINE THE SCHEMA
// Define the structure of the User document with necessary fields and options.
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true, // Removes whitespace from both ends of a string
    },
    // IMPORTANT: This field is where the HASHED password should be stored.
    password: {
      type: String,
      required: true,
    },
    // Added a simple email field which is common for user models.
  },
  {
    // Automatically adds `createdAt` and `updatedAt` fields
    timestamps: true,
  }
);

// STEP 2: CREATE THE MODEL USING THE SCHEMA
// The model name 'User' will correspond to the 'users' collection in MongoDB.
const User = mongoose.model("User", userSchema);

// STEP 3: EXPORT THE MODEL (Using ES Module syntax, `export default`)
export default User;
