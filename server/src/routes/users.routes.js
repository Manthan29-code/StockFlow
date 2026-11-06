const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const { auth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { createUserSchema, updateUserSchema, resetPasswordSchema } = require('../schemas/users.schema');

// 4. GET /users (A)
router.get('/users', auth, requireAdmin, async (req, res, next) => {
  try {
    const users = await authService.listUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// 5. POST /users (A)
router.post('/users', auth, requireAdmin, validate(createUserSchema), async (req, res, next) => {
  try {
    const user = await authService.createUser(req.user.id, req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

// 6. PATCH /users/:id (A)
router.patch('/users/:id', auth, requireAdmin, validate(updateUserSchema), async (req, res, next) => {
  try {
    const user = await authService.updateUser(req.user.id, req.params.id, req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// 7. POST /users/:id/reset-password (A)
router.post('/users/:id/reset-password', auth, requireAdmin, validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const result = await authService.resetPassword(req.user.id, req.params.id, req.body.newPassword);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 8. DELETE /users/:id (A)
router.delete('/users/:id', auth, requireAdmin, async (req, res, next) => {
  try {
    const result = await authService.deleteUser(req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

