const express = require('express');
const router = express.Router();
const incomingRepo = require('../repositories/incoming.repo');
const stockService = require('../services/stock.service');
const { auth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { createIncomingSchema, updateIncomingSchema } = require('../schemas/incoming.schema');
const { mapIncomingEntry } = require('../db/mappers');

// 27. GET /incoming?material_id= (S)
router.get('/incoming', auth, async (req, res, next) => {
  try {
    const materialId = req.query.material_id || req.query.materialId || null;
    const entries = await incomingRepo.listByMaterial(materialId, true);
    res.json(entries.map(mapIncomingEntry));
  } catch (err) {
    next(err);
  }
});

// 28. POST /incoming (S)
router.post('/incoming', auth, validate(createIncomingSchema), async (req, res, next) => {
  try {
    const entry = await stockService.addIncoming(req.user.id, req.body);
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

// 29. PATCH /incoming/:id (A)
router.patch('/incoming/:id', auth, requireAdmin, validate(updateIncomingSchema), async (req, res, next) => {
  try {
    const entry = await stockService.editIncoming(req.user.id, req.params.id, req.body);
    res.json(entry);
  } catch (err) {
    next(err);
  }
});

// 30. DELETE /incoming/:id (A)
router.delete('/incoming/:id', auth, requireAdmin, async (req, res, next) => {
  try {
    const result = await stockService.deleteIncoming(req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

