const express = require('express');
const router = express.Router();
const datasetService = require('../services/dataset.service');
const restoreService = require('../services/restore.service');
const { ensureDatabaseSchema } = require('../services/schema.service');
const auditRepo = require('../repositories/audit.repo');
const usersRepo = require('../repositories/users.repo');
const materialsRepo = require('../repositories/materials.repo');
const partiesRepo = require('../repositories/parties.repo');
const productsRepo = require('../repositories/products.repo');
const { auth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { restoreSchema, auditQuerySchema } = require('../schemas/admin.schema');
const { mapAuditLog, mapUserBadge } = require('../db/mappers');

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

// POST /admin/schema/init (A) - Verify or auto-create tables for fresh databases
router.post('/admin/schema/init', auth, requireAdmin, async (req, res, next) => {
  try {
    const result = await ensureDatabaseSchema();
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

    const [logs, total, users, materials, parties, products] = await Promise.all([
      auditRepo.listAuditLogs({ entity, userId, limit, offset }),
      auditRepo.countAuditLogs({ entity, userId }),
      usersRepo.listUsers(),
      materialsRepo.listMaterials(true),
      partiesRepo.listParties(),
      productsRepo.listProducts(),
    ]);

    const userMap = new Map(users.map((u) => [u.id, mapUserBadge(u)]));
    const materialMap = new Map(materials.map((m) => [m.id, { name: m.name, unitCode: m.unit ? m.unit.code : '' }]));
    const partyMap = new Map(parties.map((p) => [p.id, p.name]));
    const productMap = new Map(products.map((p) => [p.id, p.name]));

    const context = { userMap, materialMap, partyMap, productMap };

    res.json({
      total,
      limit,
      offset,
      logs: logs.map((log) => mapAuditLog(log, context)),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

