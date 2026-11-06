const express = require('express');
const router = express.Router();
const partiesRepo = require('../repositories/parties.repo');
const auditRepo = require('../repositories/audit.repo');
const metaRepo = require('../repositories/meta.repo');
const { broadcast } = require('../realtime/broadcaster');
const { withTransaction } = require('../db/tx');
const { auth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { createPartySchema, updatePartySchema } = require('../schemas/parties.schema');
const { DuplicateError, NotFoundError, VersionConflictError } = require('../utils/errors');
const { mapParty } = require('../db/mappers');

// 16. GET /parties (S)
router.get('/parties', auth, async (req, res, next) => {
  try {
    const parties = await partiesRepo.listParties();
    res.json(parties.map(mapParty));
  } catch (err) {
    next(err);
  }
});

// 17. POST /parties (A)
router.post('/parties', auth, requireAdmin, validate(createPartySchema), async (req, res, next) => {
  try {
    const existing = await partiesRepo.findByName(req.body.name);
    if (existing) {
      throw DuplicateError(`Party with name '${req.body.name}' already exists`);
    }

    const { party, revision } = await withTransaction(async (tx) => {
      const created = await partiesRepo.createParty({
        ...req.body,
        createdBy: req.user.id,
        updatedBy: req.user.id,
      }, tx);

      const rev = await metaRepo.bumpRevision(tx);
      await auditRepo.createAuditEntry({
        userId: req.user.id,
        action: 'CREATE',
        entity: 'parties',
        entityId: created.id,
        after: mapParty(created),
      }, tx);

      return { party: created, revision: rev };
    });

    broadcast({
      type: 'changed',
      revision,
      entity: 'parties',
      by: req.user.id,
    });

    res.status(201).json(mapParty(party));
  } catch (err) {
    next(err);
  }
});

// 18. PATCH /parties/:id (A)
router.patch('/parties/:id', auth, requireAdmin, validate(updatePartySchema), async (req, res, next) => {
  try {
    const existing = await partiesRepo.findById(req.params.id);
    if (!existing) {
      throw NotFoundError('Party not found');
    }

    if (req.body.version !== undefined && existing.version !== req.body.version) {
      throw VersionConflictError('Party was modified by another user');
    }

    if (req.body.name && req.body.name !== existing.name) {
      const nameDuplicate = await partiesRepo.findByName(req.body.name);
      if (nameDuplicate && nameDuplicate.id !== req.params.id) {
        throw DuplicateError(`Party name '${req.body.name}' is already in use`);
      }
    }

    const { party, revision } = await withTransaction(async (tx) => {
      const updated = await partiesRepo.updateParty(req.params.id, {
        ...req.body,
        updatedBy: req.user.id,
      }, tx);

      const rev = await metaRepo.bumpRevision(tx);
      await auditRepo.createAuditEntry({
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'parties',
        entityId: req.params.id,
        before: mapParty(existing),
        after: mapParty(updated),
      }, tx);

      return { party: updated, revision: rev };
    });

    broadcast({
      type: 'changed',
      revision,
      entity: 'parties',
      by: req.user.id,
    });

    res.json(mapParty(party));
  } catch (err) {
    next(err);
  }
});

module.exports = router;

