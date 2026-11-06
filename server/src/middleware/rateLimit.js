const rateLimit = require('express-rate-limit');
const config = require('../config');
const { RateLimitedError } = require('../utils/errors');

const loginLimiter = rateLimit({
  windowMs: (config.LOGIN_RATE_LIMIT_WINDOW_MIN || 15) * 60 * 1000,
  max: config.LOGIN_RATE_LIMIT_MAX || 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(RateLimitedError('Too many login attempts. Please try again later.'));
  },
});

module.exports = {
  loginLimiter,
};

