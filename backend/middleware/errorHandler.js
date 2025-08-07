import logger from '../utils/logger.js';

export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (config.server.nodeEnv === 'development') {
    logger.error('Error 🔥', { 
      message: err.message,
      stack: err.stack,
      status: err.status,
      statusCode: err.statusCode
    });

    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  } else {
    // Production error handling
    if (err.isOperational) {
      logger.error('Operational Error', { 
        message: err.message,
        status: err.status,
        statusCode: err.statusCode
      });

      res.status(err.statusCode).json({
        status: err.status,
        message: err.message
      });
    } else {
      // Programming or unknown errors
      logger.error('Programming Error', { 
        error: err,
        message: 'Something went wrong!'
      });

      res.status(500).json({
        status: 'error',
        message: 'Something went wrong!'
      });
    }
  }
}; 