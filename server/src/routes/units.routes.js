const express = require('express');
const router = express.Router();
const unitsRepo = require('../repositories/units.repo');
const auditRepo = require('../repositories/audit.repo');
const metaRepo = require('../repositories/meta.repo');
const { broadcast } = require('../realtime/broadcaster');
const { withTransaction } = require('../db/tx');
const { auth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { createUnitSchema, updateUnitSchema } = require('../schemas/units.schema');
const { DuplicateError, NotFoundError, VersionConflictError } = require('../utils/errors');
const { mapUnit } = require('../db/mappers');

// 8. GET /units (S)
router.get('/units', auth, async (req, res, next) => {
  try {
    const units = await unitsRepo.listUnits();
    res.json(units.map(mapUnit));
  } catch (err) {
    next(err);
  }
});

// 9. POST /units (A)
router.post('/units', auth, requireAdmin, validate(createUnitSchema), async (req, res, next) => {
  try {
    const existing = await unitsRepo.findByCode(req.body.code);
    if (existing) {
      throw DuplicateError(`Unit with code '${req.body.code.trim().toLowerCase()}' already exists`);
    }

    const { unit, revision } = await withTransaction(async (tx) => {
      const created = await unitsRepo.createUnit({
        ...req.body,
        createdBy: req.user.id,
        updatedBy: req.user.id,
      }, tx);

      const rev = await metaRepo.bumpRevision(tx);
      await auditRepo.createAuditEntry({
        userId: req.user.id,
        action: 'CREATE',
        entity: 'units',
        entityId: created.id,
        after: mapUnit(created),
      }, tx);

      return { unit: created, revision: rev };
    });

    broadcast({
      type: 'changed',
      revision,
      entity: 'units',
      by: req.user.id,
    });

    res.status(201).json(mapUnit(unit));
  } catch (err) {
    next(err);
  }
});

// 10. PATCH /units/:id (A)
router.patch('/units/:id', auth, requireAdmin, validate(updateUnitSchema), async (req, res, next) => {
  try {
    const existing = await unitsRepo.findById(req.params.id);
    if (!existing) {
      throw NotFoundError('Unit not found');
    }

    if (req.body.version !== undefined && existing.version !== req.body.version) {
      throw VersionConflictError('Unit was modified by another user');
    }

    const { unit, revision } = await withTransaction(async (tx) => {
      const updated = await unitsRepo.updateUnit(req.params.id, {
        name: req.body.name,
        updatedBy: req.user.id,
      }, tx);

      const rev = await metaRepo.bumpRevision(tx);
      await auditRepo.createAuditEntry({
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'units',
        entityId: req.params.id,
        before: mapUnit(existing),
        after: mapUnit(updated),
      }, tx);

      return { unit: updated, revision: rev };
    });

    broadcast({
      type: 'changed',
      revision,
      entity: 'units',
      by: req.user.id,
    });

    res.json(mapUnit(unit));
  } catch (err) {
    next(err);
  }
});

module.exports = router;

