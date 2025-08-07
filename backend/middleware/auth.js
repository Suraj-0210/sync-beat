import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { AppError } from './errorHandler.js';
import User from '../models/user.model.js';

export const protect = async (req, res, next) => {
  try {
    // 1) Get token
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      throw new AppError('You are not logged in! Please log in to get access.', 401);
    }

    // 2) Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // 3) Check if user still exists
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      throw new AppError('The user belonging to this token no longer exists.', 401);
    }

    // Grant access to protected route
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new AppError('Invalid token. Please log in again!', 401));
    } else if (error.name === 'TokenExpiredError') {
      next(new AppError('Your token has expired! Please log in again.', 401));
    } else {
      next(error);
    }
  }
};

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
}; 