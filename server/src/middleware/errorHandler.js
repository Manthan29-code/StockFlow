const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');
const { ERROR_CODES } = require('@stockflow/shared');

function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    logger.warn(`AppError [${err.code}]: ${err.message}`, {
      path: req.originalUrl,
      method: req.method,
      statusCode: err.statusCode,
    });

    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details || {},
      },
    });
  }

  // Handle unexpected errors
  logger.error('Unhandled server error:', {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  return res.status(500).json({
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'An unexpected internal server error occurred',
      details: {},
    },
  });
}

module.exports = {
  errorHandler,
};

