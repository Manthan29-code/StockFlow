const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const { auth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimit');
const { loginSchema, changePasswordSchema } = require('../schemas/auth.schema');

// 1. POST /auth/login
router.post('/auth/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 2. GET /auth/me
router.get('/auth/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// 3. POST /auth/change-password
router.post('/auth/change-password', auth, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

