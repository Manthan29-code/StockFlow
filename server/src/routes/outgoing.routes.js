const express = require('express');
const router = express.Router();
const stockService = require('../services/stock.service');
const { auth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { createOutgoingSchema, updateOutgoingSchema } = require('../schemas/outgoing.schema');

// 31. POST /outgoing (S)
router.post('/outgoing', auth, validate(createOutgoingSchema), async (req, res, next) => {
  try {
    const row = await stockService.addOutgoing(req.user.id, req.body);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

// 32. PATCH /outgoing/:id (A)
router.patch('/outgoing/:id', auth, requireAdmin, validate(updateOutgoingSchema), async (req, res, next) => {
  try {
    const row = await stockService.editOutgoing(req.user.id, req.params.id, req.body);
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// 33. DELETE /outgoing/:id (A)
router.delete('/outgoing/:id', auth, requireAdmin, async (req, res, next) => {
  try {
    const result = await stockService.deleteOutgoing(req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

