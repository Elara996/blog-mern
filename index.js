import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcryptjs";
import JsonWebToken from "jsonwebtoken";
import User from "./models/user.js";
import cookieParser from "cookie-parser";
import multer from "multer";
import fs from "fs";
import Post from "./models/Post.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

const uploadMiddleware = multer({ dest: "uploads/" });
dotenv.config();

const salt = bcrypt.genSaltSync(10);
const app = express();
const secret = process.env.JWT_SECRET || "supersecret";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Middlewares
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// Middleware to parse JSON bodies

// 1. --- CONNECT TO MONGODB ---
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

// 2. --- ADD THE NEW HEALTH CHECK/ROOT ROUTE HERE ---
app.get("/", (req, res) => {
  // This is what the browser sees when visiting the root URL
  res.status(200).json({
    message: "MERN Blog API is live and running!",
    serviceStatus: "OK",
    database: "Connected",
  });
});
// Register route
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.status(201).json(userDoc);
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Login Route
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const userDoc = await User.findOne({ username });

    if (!userDoc)
      return res.status(401).json({ message: "Invalid credentials" });

    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (!passOk)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = JsonWebToken.sign({ username, id: userDoc._id }, secret);

    // Set cookie with explicit domain
    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "Lax",
        secure: process.env.NODE_ENV === "production",
        domain: "localhost",
      })
      .json({
        id: userDoc._id,
        username,
      });
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Profile route
app.get("/api/profile", (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "No token found" });

  JsonWebToken.verify(token, secret, {}, (err, info) => {
    if (err) return res.status(401).json({ message: "Invalid token" });
    res.json(info);
  });
});

// Logout route
app.post("/api/logout", (req, res) => {
  res.cookie("token", "", { maxAge: 0 });
  res.json({ message: "Logged out" });
});

// Create Post route with file upload
app.post("/api/post", uploadMiddleware.single("cover"), async (req, res) => {
  const { token } = req.cookies;

  JsonWebToken.verify(token, secret, {}, async (err, info) => {
    if (err)
      return res
        .status(401)
        .json({ message: "Invalid token or not logged in." });

    if (!req.file)
      return res.status(400).json({ message: "No file uploaded." });

    // File Handling
    const { originalname, path } = req.file;
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    const newPath = path + "." + ext;
    fs.renameSync(path, newPath);

    //  Post Creation
    const { title, summary, content } = req.body;

    try {
      const postDoc = await Post.create({
        title,
        summary,
        content,
        cover: newPath,
        author: info.id,
      });
      res.status(201).json(postDoc);
    } catch (e) {
      console.error("Error creating post in DB:", e);
      res.status(400).json({ message: "Post creation failed.", error: e });
    }
  });
});

app.get("/api/post", async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("author", ["username"])
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ message: "Server error fetching posts" });
  }
});

// Route to fetch a single post by its ID
app.get("/api/post/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const postDoc = await Post.findById(id).populate("author", ["username"]);
    if (!postDoc) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.json(postDoc);
  } catch (error) {
    console.error("Error fetching single post:", error);
    res.status(500).json({ message: "Server error fetching post" });
  }
});

app.put("/api/post", uploadMiddleware.single("cover"), async (req, res) => {
  const { token } = req.cookies;

  JsonWebToken.verify(token, secret, {}, async (err, info) => {
    if (err)
      return res
        .status(401)
        .json({ message: "Invalid token or not logged in." });

    const { id, title, summary, content } = req.body;

    const postDoc = await Post.findById(id);

    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    res.json(isAuthor.postDoc.info);
    if (!isAuthor) {
      return res
        .status(403)
        .json({ message: "You are not the author and cannot edit this post." });
    }

    let newPath = postDoc.cover;

    if (req.file) {
      const { originalname, path } = req.file;
      const parts = originalname.split(".");
      const ext = parts[parts.length - 1];
      newPath = path + "." + ext;
      fs.renameSync(path, newPath);
    }

    // 3. Update the document in MongoDB
    await postDoc.updateOne({
      title,
      summary,
      content,
      cover: newPath,
    });

    // 4. Send the updated document back to the frontend
    const updatedPost = await Post.findById(id).populate("author", [
      "username",
    ]);

    res.json(updatedPost);
  });
});

// Start server
app.listen(5000, () => console.log("Server running on port 5000"));
