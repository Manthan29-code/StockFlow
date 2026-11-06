const { ERROR_CODES } = require('@stockflow/shared');

class AppError extends Error {
  constructor(code, message, statusCode = 400, details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function ValidationError(message, details = {}) {
  return new AppError(ERROR_CODES.VALIDATION_ERROR, message, 422, details);
}

function InsufficientBalanceError(message = 'Insufficient stock balance', details = {}) {
  return new AppError(ERROR_CODES.INSUFFICIENT_BALANCE, message, 422, details);
}

function VersionConflictError(message = 'Record has been updated by another user', details = {}) {
  return new AppError(ERROR_CODES.VERSION_CONFLICT, message, 409, details);
}

function DuplicateError(message = 'Record already exists', details = {}) {
  return new AppError(ERROR_CODES.DUPLICATE, message, 409, details);
}

function NotFoundError(message = 'Resource not found', details = {}) {
  return new AppError(ERROR_CODES.NOT_FOUND, message, 404, details);
}

function ForbiddenError(message = 'Access forbidden', details = {}) {
  return new AppError(ERROR_CODES.FORBIDDEN, message, 403, details);
}

function UnauthorizedError(message = 'Authentication required', details = {}) {
  return new AppError(ERROR_CODES.UNAUTHORIZED, message, 401, details);
}

function RateLimitedError(message = 'Too many requests, please try again later', details = {}) {
  return new AppError(ERROR_CODES.RATE_LIMITED, message, 429, details);
}

module.exports = {
  AppError,
  ValidationError,
  InsufficientBalanceError,
  VersionConflictError,
  DuplicateError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  RateLimitedError,
};

