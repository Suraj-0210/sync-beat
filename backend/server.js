import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.route.js";
import bodyParser from "body-parser";
import axios from "axios";

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

app.use(bodyParser.json());

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

  socket.on("playSong", ({ roomCode, song, startTime }) => {
    //console.log("song playing name:" + song.name);
    //console.log("Received playSong event:", { roomCode, song, startTime });
    const state = {
      song,
      startTime,
      isPlaying: true,
    };
    roomStates[roomCode] = state;
    //console.log("Broadcasting to room:", roomCode, "State:", state);
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

  socket.on("seek-audio", ({ time, roomCode }) => {
    console.log(`⏱️ Syncing audio for room ${roomCode} to ${time}s`);

    // Broadcast to others in the room (excluding the sender)
    socket.to(roomCode).emit("seek-audio", { time });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

app.post("/api/download", async (req, res) => {
  try {
    const { song_name, artist_name, url } = req.body;
    console.log(song_name + "Song ");
    console.log(artist_name + "artist ");
    console.log(url + "url ");

    const response = await axios.post(
      "https://spotisongdownloader.to/api/composer/spotify/ssdw23456ytrfds.php",
      new URLSearchParams({
        song_name,
        artist_name,
        url,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Cookie:
            "PHPSESSID=468b75f4db48005d3650dcc34d599205; cf_token=3f53cd2816289943541a9d726e9c93fa; quality=128",
          Origin: "https://spotisongdownloader.to",
          Referer: "https://spotisongdownloader.to/track.php",
          "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5)",
          "X-Requested-With": "XMLHttpRequest",
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch download link" });
  }
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
