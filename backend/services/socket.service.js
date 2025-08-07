import { Server } from "socket.io";
import { config } from "../config/config.js";
import logger from "../utils/logger.js";
import cacheService from "./cache.service.js";

class SocketService {
  constructor() {
    this.io = null;
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: config.cors.origins,
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on("connection", (socket) => {
      logger.info("New client connected");

      socket.on("joinRoom", async (data) => {
        await this.handleJoinRoom(socket, data);
      });

      socket.on("chatMessage", async (data) => {
        await this.handleChatMessage(socket, data);
      });

      socket.on("playSong", async (data) => {
        await this.handlePlaySong(socket, data);
      });

      socket.on("pauseSong", async (roomCode) => {
        await this.handlePauseSong(socket, roomCode);
      });

      socket.on("resumeSong", async (roomCode) => {
        await this.handleResumeSong(socket, roomCode);
      });

      socket.on("seek-audio", async (data) => {
        await this.handleSeekAudio(socket, data);
      });

      // Video playback events
      socket.on("playVideo", async (data) => {
        await this.handlePlayVideo(socket, data);
      });

      socket.on("pauseVideo", async (roomCode) => {
        await this.handlePauseVideo(socket, roomCode);
      });

      socket.on("resumeVideo", async (roomCode) => {
        await this.handleResumeVideo(socket, roomCode);
      });

      socket.on("seek-video", async (data) => {
        await this.handleSeekVideo(socket, data);
      });

      socket.on("disconnect", async () => {
        await this.handleDisconnect(socket);
      });
    });
  }

  async handleJoinRoom(socket, { roomCode, userName, uid }) {
    try {
      socket.join(roomCode);
      socket.data = { roomCode, userName, uid };

      // Get or initialize room users
      let roomUsers = (await cacheService.getRoomUsers(roomCode)) || [];
      roomUsers.push({ userName, uid });
      await cacheService.setRoomUsers(roomCode, roomUsers);

      // Cancel any scheduled cleanup since the room is now active
      await cacheService.cancelRoomCleanup(roomCode);

      // Notify others
      socket.to(roomCode).emit("userJoined", {
        uid,
        userName,
        message: `${userName} has joined the room.`,
        time: new Date().toLocaleTimeString(),
      });

      // Send current room state
      this.io.to(roomCode).emit("roomUsers", roomUsers);

      // Send previous messages
      const messages = await cacheService.getRoomMessages(roomCode);
      if (messages) {
        socket.emit("previousMessages", messages);
      }

      // Send current playback state
      const roomState = await cacheService.getRoomState(roomCode);
      if (roomState) {
        if (roomState.type === "video") {
          socket.emit("playVideo", roomState);
        } else {
          socket.emit("playSong", roomState);
        }
      }

      logger.info(`User ${userName} joined room ${roomCode}`);
    } catch (error) {
      logger.error("Error in handleJoinRoom:", error);
    }
  }

  async handleChatMessage(socket, { roomCode, message, userName, time }) {
    try {
      const chatMessage = {
        userName,
        message,
        time: time || new Date().toLocaleTimeString(),
      };

      // Store message in cache
      let messages = (await cacheService.getRoomMessages(roomCode)) || [];
      messages.push(chatMessage);
      await cacheService.setRoomMessages(roomCode, messages);

      this.io.to(roomCode).emit("chatMessage", chatMessage);
      logger.debug(`Chat message in room ${roomCode}: ${message}`);
    } catch (error) {
      logger.error("Error in handleChatMessage:", error);
    }
  }

  async handlePlaySong(socket, { roomCode, song, startTime }) {
    try {
      const state = { song, startTime, isPlaying: true, type: "audio" };
      await cacheService.setRoomState(roomCode, state);
      this.io.to(roomCode).emit("playSong", state);
      logger.debug(`Playing song in room ${roomCode}: ${song.name}`);
    } catch (error) {
      logger.error("Error in handlePlaySong:", error);
    }
  }

  async handlePlayVideo(socket, { roomCode, video, startTime }) {
    try {
      const state = { video, startTime, isPlaying: true, type: "video" };
      await cacheService.setRoomState(roomCode, state);
      this.io.to(roomCode).emit("playVideo", state);
      logger.debug(`Playing video in room ${roomCode}: ${video.name}`);
    } catch (error) {
      logger.error("Error in handlePlayVideo:", error);
    }
  }

  async handlePauseSong(socket, roomCode) {
    try {
      const state = await cacheService.getRoomState(roomCode);
      if (state) {
        state.isPlaying = false;
        await cacheService.setRoomState(roomCode, state);
      }
      this.io.to(roomCode).emit("pauseSong");
      logger.debug(`Paused song in room ${roomCode}`);
    } catch (error) {
      logger.error("Error in handlePauseSong:", error);
    }
  }

  async handleResumeSong(socket, roomCode) {
    try {
      const state = await cacheService.getRoomState(roomCode);
      if (state) {
        state.isPlaying = true;
        await cacheService.setRoomState(roomCode, state);
      }
      this.io.to(roomCode).emit("resumeSong");
      logger.debug(`Resumed song in room ${roomCode}`);
    } catch (error) {
      logger.error("Error in handleResumeSong:", error);
    }
  }

  async handleSeekAudio(socket, { time, roomCode }) {
    try {
      socket.to(roomCode).emit("seek-audio", { time });
      logger.debug(`Seeking audio in room ${roomCode} to ${time}s`);
    } catch (error) {
      logger.error("Error in handleSeekAudio:", error);
    }
  }

  async handlePauseVideo(socket, roomCode) {
    try {
      const state = await cacheService.getRoomState(roomCode);
      if (state) {
        state.isPlaying = false;
        await cacheService.setRoomState(roomCode, state);
      }
      this.io.to(roomCode).emit("pauseVideo");
      logger.debug(`Paused video in room ${roomCode}`);
    } catch (error) {
      logger.error("Error in handlePauseVideo:", error);
    }
  }

  async handleResumeVideo(socket, roomCode) {
    try {
      const state = await cacheService.getRoomState(roomCode);
      if (state) {
        state.isPlaying = true;
        await cacheService.setRoomState(roomCode, state);
      }
      this.io.to(roomCode).emit("resumeVideo");
      logger.debug(`Resumed video in room ${roomCode}`);
    } catch (error) {
      logger.error("Error in handleResumeVideo:", error);
    }
  }

  async handleSeekVideo(socket, { time, roomCode }) {
    try {
      socket.to(roomCode).emit("seek-video", { time });
      logger.debug(`Seeking video in room ${roomCode} to ${time}s`);
    } catch (error) {
      logger.error("Error in handleSeekVideo:", error);
    }
  }

  async handleDisconnect(socket) {
    try {
      const { userName, uid, roomCode } = socket.data;

      if (roomCode && uid) {
        // Notify others
        socket.to(roomCode).emit("userLeft", {
          userName,
          message: `${userName} has left the room.`,
          time: new Date().toLocaleTimeString(),
        });

        // Update room users
        let roomUsers = (await cacheService.getRoomUsers(roomCode)) || [];
        roomUsers = roomUsers.filter((u) => u.uid !== uid);

        // Update the room users list
        await cacheService.setRoomUsers(roomCode, roomUsers);

        // Broadcast updated user list
        this.io.to(roomCode).emit("roomUsers", roomUsers);

        logger.info(`User ${userName} disconnected from room ${roomCode}`);
      }
    } catch (error) {
      logger.error("Error in handleDisconnect:", error);
    }
  }
}

export default new SocketService();
