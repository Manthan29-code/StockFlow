const jwt = require('jsonwebtoken');
const config = require('../config');
const usersRepo = require('../repositories/users.repo');
const { UnauthorizedError } = require('../utils/errors');

async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw UnauthorizedError('Authorization token required');
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, config.JWT_SECRET);
    } catch (err) {
      throw UnauthorizedError('Invalid or expired token');
    }

    if (!payload.userId) {
      throw UnauthorizedError('Invalid token payload');
    }

    const user = await usersRepo.findById(payload.userId);
    if (!user) {
      throw UnauthorizedError('User does not exist');
    }

    if (!user.isActive) {
      throw UnauthorizedError('User account is disabled');
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      color: user.color,
      isActive: user.isActive,
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  auth,
};

