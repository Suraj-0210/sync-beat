import dotenv from "dotenv";

dotenv.config();

export const config = {
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || "development",
  },
  db: {
    uri: process.env.MONGO_URI || "mongodb://localhost:27017/music_drive_app",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "temporary_secret_change_in_production",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  cors: {
    origins: (process.env.CORS_ORIGINS || "http://localhost:4200").split(","),
    credentials: true,
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6380,
    password: process.env.REDIS_PASSWORD || null,
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },
  cookie: {
    secret: process.env.COOKIE_SECRET || "temporary_cookie_secret",
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
};
