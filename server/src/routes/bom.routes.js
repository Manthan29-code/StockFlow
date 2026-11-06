const express = require('express');
const router = express.Router();
const bomService = require('../services/bom.service');
const { auth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { updateBomLineSchema } = require('../schemas/bom.schema');

// 25. PATCH /bom-lines/:id (A)
router.patch('/bom-lines/:id', auth, requireAdmin, validate(updateBomLineSchema), async (req, res, next) => {
  try {
    const line = await bomService.editBomLine(req.user.id, req.params.id, req.body);
    res.json(line);
  } catch (err) {
    next(err);
  }
});

// 26. DELETE /bom-lines/:id (A)
router.delete('/bom-lines/:id', auth, requireAdmin, async (req, res, next) => {
  try {
    const result = await bomService.deleteBomLine(req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

