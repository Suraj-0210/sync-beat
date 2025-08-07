import express from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { config } from "./config/config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import logger from "./utils/logger.js";
import socketService from "./services/socket.service.js";
import authRoutes from "./routes/auth.route.js";
import axios from "axios";

// Initialize express app
const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.cors.origins,
    credentials: config.cors.credentials,
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api", limiter);

// Body parsing middleware
app.use(bodyParser.json());
app.use(express.json());

// Initialize Socket.IO
socketService.initialize(server);

// Connect to MongoDB
mongoose
  .connect(config.db.uri)
  .then(() => {
    logger.info("MongoDB connected successfully");
  })
  .catch((err) => {
    logger.error("MongoDB connection error:", err);
    process.exit(1);
  });

// API Routes
app.use("/api/auth", authRoutes);

// Download endpoint with rate limiting
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
});

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = config.server.port;
server.listen(PORT, () => {
  logger.info(
    `Server running in ${config.server.nodeEnv} mode on port ${PORT}`,
  );
});
