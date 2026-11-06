const express = require('express');
const router = express.Router();
const importService = require('../services/import.service');
const { auth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { commitMaterialImportSchema, commitBomImportSchema } = require('../schemas/import.schema');

// 40. POST /import/materials/:id/commit (A)
router.post('/import/materials/:id/commit', auth, requireAdmin, validate(commitMaterialImportSchema), async (req, res, next) => {
  try {
    const result = await importService.commitMaterialImport(req.user.id, req.params.id, req.body.entries);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 41. POST /import/bom/commit (A)
router.post('/import/bom/commit', auth, requireAdmin, validate(commitBomImportSchema), async (req, res, next) => {
  try {
    const result = await importService.commitBomImport(req.user.id, req.body.items);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

