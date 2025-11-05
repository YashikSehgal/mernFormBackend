import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Model from "./models/Schema.js";
import nodemailer from "nodemailer";
import multer from "multer";
import path from "path";
import fs from "fs";

dotenv.config({
  path: "./config/config.env",
});

const app = express();
app.use(cors());
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
  .connect(process.env.MONGO_DATABASE)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ------------------- ROUTES -------------------
app.get("/", (req, res) => res.send("Hello World"));

app.get("/collectionData", async (req, res) => {
  try {
    const data = await Model.find({});
    res.json(data);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch data" });
  }
});

// 🟢 Multiple image upload
app.post("/addUser", upload.array("images", 5), async (req, res) => {
  try {
    const { name, age, message, email } = req.body;
    
    const imagePaths = req.files.map(
        (file) => `${req.protocol}://${req.get("host")}/uploads/${path.basename(file.path)}`
      );



    if (!name || !age || !message || !email || imagePaths.length === 0) {
      return res.status(400).json({ error: "All fields are required!" });
    }

    // Save to MongoDB
    const newUser = new Model({
      name,
      age,
      message,
      email,
      image: imagePaths, // 👈 store as array
    });

    const savedUser = await newUser.save();

    // ✉️ Send email with attachments
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

    await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully!");
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
const PORT = process.env.PORT || 3006;
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
