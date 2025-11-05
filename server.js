import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Model from "./models/Schema.js";
import nodemailer from "nodemailer";
import multer from "multer";
import path from "path";
import fs from "fs";

// Load environment variables from .env file
dotenv.config({
  path: "./config/config.env",  // Ensure your .env file path is correct
});

const app = express();

// Set CORS policy to allow the frontend domain
app.use(cors({ origin: 'https://mernformfrontend.netlify.app' }));
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ------------------- MULTER SETUP -------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "./uploads";
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + file.originalname.split(" ").join("_");
    cb(null, file.fieldname + "-" + uniqueSuffix);
  },
});
const upload = multer({ storage });

// ------------------- MONGO CONNECTION -------------------
mongoose
  .connect(process.env.MONGO_DATABASE)  // Ensure this is set in your .env file
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1); // Exit the app if MongoDB connection fails
  });

// ------------------- ROUTES -------------------

// Root route (optional)
app.get("/", (req, res) => res.send("Hello World"));

// Get all collection data
app.get("/collectionData", async (req, res) => {
  try {
    const data = await Model.find({});
    res.json(data);
  } catch (error) {
    console.error("❌ Error fetching collection data:", error);
    res.status(500).send({ error: "Failed to fetch data" });
  }
});

// 🟢 Multiple image upload route
app.post("/addUser", upload.array("images", 5), async (req, res) => {
  try {
    console.log("Request Body:", req.body);  // Log incoming form data
    console.log("Uploaded Files:", req.files);  // Log uploaded files
    
    const { name, age, message, email } = req.body;
    
    if (!name || !age || !message || !email || req.files.length === 0) {
      return res.status(400).json({ error: "All fields are required!" });
    }

    // Generate image paths (you may need to adjust this based on where your files are stored)
    const imagePaths = req.files.map(
      (file) => `${req.protocol}://${req.get("host")}/uploads/${path.basename(file.path)}`
    );

    // Create and save new user to MongoDB
    const newUser = new Model({
      name,
      age,
      message,
      email,
      image: imagePaths,  // Save image URLs as an array
    });

    const savedUser = await newUser.save();

    // Send email with attachments (using nodemailer)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "New User Submitted the Form",
      text: `
        A new user has submitted the form:
        Name: ${name}
        Age: ${age}
        Message: ${message}
        Email: ${email}
      `,
      attachments: imagePaths.map((img) => ({
        filename: path.basename(img),
        path: img,
      })),
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully!");
    
    // Respond with success
    res.status(201).json({
      message: "User added and email sent",
      data: savedUser,
    });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Failed to save user or send email" });
  }
});

// ------------------- SERVER -------------------
// Get the port from environment variables or use default
const PORT = process.env.PORT || 3006;
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
