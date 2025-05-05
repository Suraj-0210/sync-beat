import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.route.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:4200", "https://sync-beat.vercel.app"],
    methods: ["GET", "POST"],
  },
});

mongoose
  .connect(
    "mongodb+srv://kantaprustys:Suryakanta02%40@cluster01.i5mwj.mongodb.net/sync-beat?retryWrites=true&w=majority&appName=Cluster01"
  )
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

const allowedOrigins = [
  "http://localhost:4200",
  "https://sync-beat.vercel.app",
];

// Apply CORS to Express
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json()); // Important: handle JSON requests
app.use("/api/auth", authRoutes);

let rooms = {};

// Maintain state per room
const roomStates = {};

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("joinRoom", (roomCode) => {
    socket.join(roomCode);
    console.log(`User joined room: ${roomCode}`);

    if (rooms[roomCode]) {
      socket.emit("previousMessages", rooms[roomCode]);
    }

    if (roomStates[roomCode]) {
      socket.emit("playSong", roomStates[roomCode]); // Send current playback state to the new user
    }
  });

  socket.on("chatMessage", ({ roomCode, message, userName, time }) => {
    console.log("Message Received");
    if (!rooms[roomCode]) rooms[roomCode] = [];

    const chatMessage = {
      userName,
      message,
      time: time || new Date().toLocaleTimeString(),
    };
    rooms[roomCode].push(chatMessage);
    io.to(roomCode).emit("chatMessage", chatMessage);
  });

  socket.on("playSong", ({ roomCode, songUrl, startTime }) => {
    console.log("Received playSong event:", { roomCode, songUrl, startTime });
    const state = {
      songUrl,
      startTime,
      isPlaying: true,
    };
    roomStates[roomCode] = state;
    console.log("Broadcasting to room:", roomCode, "State:", state);
    io.to(roomCode).emit("playSong", state);
  });

  socket.on("pauseSong", (roomCode) => {
    if (roomStates[roomCode]) {
      roomStates[roomCode].isPlaying = false;
    }
    io.to(roomCode).emit("pauseSong");
  });
  socket.on("resumeSong", (roomCode) => {
    io.to(roomCode).emit("resumeSong");
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
