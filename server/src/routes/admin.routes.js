const express = require('express');
const router = express.Router();
const datasetService = require('../services/dataset.service');
const restoreService = require('../services/restore.service');
const auditRepo = require('../repositories/audit.repo');
const { auth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { restoreSchema, auditQuerySchema } = require('../schemas/admin.schema');
const { mapAuditLog } = require('../db/mappers');

// 37. GET /admin/backup (A)
router.get('/admin/backup', auth, requireAdmin, async (req, res, next) => {
  try {
    const backup = await datasetService.buildDataset(true);
    res.json(backup);
  } catch (err) {
    next(err);
  }
});

// 38. POST /admin/restore (A)
router.post('/admin/restore', auth, requireAdmin, validate(restoreSchema), async (req, res, next) => {
  try {
    const result = await restoreService.restoreBackup(req.user.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 39. GET /admin/audit (A)
router.get('/admin/audit', auth, requireAdmin, validate(auditQuerySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.validatedQuery || req.query || {};
    const entity = q.entity || undefined;
    const userId = q.userId || undefined;
    const limit = Number(q.limit) || 50;
    const offset = Number(q.offset) || 0;

    const [logs, total] = await Promise.all([
      auditRepo.listAuditLogs({ entity, userId, limit, offset }),
      auditRepo.countAuditLogs({ entity, userId }),
    ]);

    res.json({
      total,
      limit,
      offset,
      logs: logs.map(mapAuditLog),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

