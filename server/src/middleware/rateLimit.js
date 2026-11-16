const rateLimit = require('express-rate-limit');
const config = require('../config');
const { RateLimitedError } = require('../utils/errors');

const loginLimiter = rateLimit({
  windowMs: (config.LOGIN_RATE_LIMIT_WINDOW_MIN || 15) * 60 * 1000,
  max: config.LOGIN_RATE_LIMIT_MAX || 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Cloudflare Workers & proxy compatibility:
  validate: {
    ip: false, // Prevents ERR_ERL_UNDEFINED_IP_ADDRESS in serverless / worker environments
  },
  keyGenerator: (req) => {
    return req.headers['cf-connecting-ip'] ||
      (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) ||
      req.ip ||
      '127.0.0.1';
  },
  handler: (req, res, next) => {
    next(RateLimitedError('Too many login attempts. Please try again later.'));
  },
});

module.exports = {
  loginLimiter,
};

