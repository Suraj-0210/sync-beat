import express from 'express';
import http from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './config/config.js';
import { errorHandler } from './middleware/errorHandler.js';
import logger from './utils/logger.js';
import socketService from './services/socket.service.js';
import authRoutes from './routes/auth.route.js';
import axios from 'axios';

// Initialize express app
const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origins,
  credentials: config.cors.credentials
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Body parsing middleware
app.use(bodyParser.json());
app.use(express.json());

// Initialize Socket.IO
socketService.initialize(server);

// Connect to MongoDB
mongoose
  .connect(config.db.uri)
  .then(() => {
    logger.info('MongoDB connected successfully');
  })
  .catch((err) => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  });

// API Routes
app.use('/api/auth', authRoutes);

// Download endpoint with rate limiting
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50 // limit each IP to 50 requests per windowMs
});

app.post('/api/download', downloadLimiter, async (req, res) => {
  try {
    const { song_name, artist_name, url } = req.body;
    
    if (!song_name || !artist_name || !url) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Missing required fields' 
      });
    }

    logger.debug('Download request:', { song_name, artist_name });

    const response = await axios.post(
      'https://spotisongdownloader.to/api/composer/spotify/ssdw23456ytrfds.php',
      new URLSearchParams({ song_name, artist_name, url }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Cookie': 'PHPSESSID=468b75f4db48005d3650dcc34d599205; cf_token=3f53cd2816289943541a9d726e9c93fa; quality=128',
          'Origin': 'https://spotisongdownloader.to',
          'Referer': 'https://spotisongdownloader.to/track.php',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5)',
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );

    res.json({
      status: 'success',
      data: response.data
    });
  } catch (err) {
    logger.error('Download error:', err);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch download link',
      error: config.server.nodeEnv === 'development' ? err.message : undefined
    });
  }
});

// Error handling middleware
app.use(errorHandler);

// Handle unhandled routes
app.all('*', (req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

// Start server
const PORT = config.server.port;
server.listen(PORT, () => {
  logger.info(`Server running in ${config.server.nodeEnv} mode on port ${PORT}`);
});
