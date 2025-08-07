import User from '../models/user.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};

const setCookieToken = (res, token) => {
  res.cookie('access_token', token, {
    ...config.cookie.options,
    secure: config.server.nodeEnv === 'production'
  });
};

export const google = async (req, res, next) => {
  try {
    const { email, name, googlePhotoUrl } = req.body;

    if (!email || !name) {
      throw new AppError('Email and name are required', 400);
    }

    let user = await User.findOne({ email });

    if (user) {
      // Existing user login
      const token = generateToken(user._id);
      const { password, ...userData } = user._doc;

      setCookieToken(res, token);
      logger.info(`User logged in: ${email}`);

      return res.status(200).json({
        status: 'success',
        data: {
          ...userData,
          access_token: token
        }
      });
    }

    // Create new user
    const username = name.toLowerCase().split(' ').join('') + 
                    Math.random().toString(9).slice(-4);
    const hashedPassword = await bcrypt.hash(
      Math.random().toString(36).slice(-8), 
      10
    );

    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      profilePicture: googlePhotoUrl
    });

    const token = generateToken(newUser._id);
    const { password, ...userData } = newUser._doc;

    setCookieToken(res, token);
    logger.info(`New user created: ${email}`);

    res.status(201).json({
      status: 'success',
      data: {
        ...userData,
        access_token: token
      }
    });
  } catch (error) {
    logger.error('Google auth error:', error);
    next(error);
  }
};

export const logout = (req, res) => {
  res.clearCookie('access_token');
  res.status(200).json({
    status: 'success',
    message: 'Successfully logged out'
  });
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: user
    });
  } catch (error) {
    next(error);
  }
};
