const express = require('express');
const router = express.Router();
const materialsRepo = require('../repositories/materials.repo');
const incomingRepo = require('../repositories/incoming.repo');
const auditRepo = require('../repositories/audit.repo');
const metaRepo = require('../repositories/meta.repo');
const ledgerService = require('../services/ledger.service');
const { broadcast } = require('../realtime/broadcaster');
const { withTransaction } = require('../db/tx');
const { auth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { createMaterialSchema, updateMaterialSchema } = require('../schemas/materials.schema');
const { DuplicateError, NotFoundError, ValidationError, VersionConflictError } = require('../utils/errors');
const { mapMaterial, formatDateToYYYYMMDD } = require('../db/mappers');
const { calculateEntryLedger, calculateMaterialStock } = require('@stockflow/shared');

// 11. GET /materials (S)
router.get('/materials', auth, async (req, res, next) => {
  try {
    const materials = await materialsRepo.listMaterials(true);
    const allEntries = await incomingRepo.listByMaterial(null, true);

    const entriesByMaterial = new Map();
    for (const m of materials) {
      entriesByMaterial.set(m.id, []);
    }
    for (const e of allEntries) {
      if (entriesByMaterial.has(e.materialId)) {
        entriesByMaterial.get(e.materialId).push(e);
      }
    }

    const result = materials.map((m) => {
      const entries = entriesByMaterial.get(m.id) || [];
      const entriesWithLedger = entries.map((entry) => {
        const rawRows = entry.outgoingRows || [];
        const ledger = calculateEntryLedger(
          { quantity: entry.quantity.toString() },
          rawRows.map((r) => ({
            outDate: formatDateToYYYYMMDD(r.outDate),
            rowNo: r.rowNo,
            qty: r.qty.toString(),
            pieceWeight: r.pieceWeight ? r.pieceWeight.toString() : null,
            totalWeight: r.totalWeight ? r.totalWeight.toString() : null,
            deducted: r.deducted.toString(),
          })),
          m.deductBy
        );
        return { balance: ledger.finalBalance };
      });
      const stock = calculateMaterialStock(entriesWithLedger);

      return {
        ...mapMaterial(m),
        stock,
        totalStock: stock,
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 12. GET /materials/:id (S)
router.get('/materials/:id', auth, async (req, res, next) => {
  try {
    const material = await materialsRepo.findById(req.params.id, true);
    if (!material) {
      throw NotFoundError('Material not found');
    }
    res.json(mapMaterial(material));
  } catch (err) {
    next(err);
  }
});

// 13. POST /materials (A)
router.post('/materials', auth, requireAdmin, validate(createMaterialSchema), async (req, res, next) => {
  try {
    const existing = await materialsRepo.findByName(req.body.name);
    if (existing) {
      throw DuplicateError(`Material with name '${req.body.name}' already exists`);
    }

    const { material, revision } = await withTransaction(async (tx) => {
      const created = await materialsRepo.createMaterial({
        ...req.body,
        createdBy: req.user.id,
        updatedBy: req.user.id,
      }, tx);

      const rev = await metaRepo.bumpRevision(tx);
      await auditRepo.createAuditEntry({
        userId: req.user.id,
        action: 'CREATE',
        entity: 'materials',
        entityId: created.id,
        after: mapMaterial(created),
      }, tx);

      return { material: created, revision: rev };
    });

    broadcast({
      type: 'changed',
      revision,
      entity: 'materials',
      material_id: material.id,
      by: req.user.id,
    });

    res.status(201).json(mapMaterial(material));
  } catch (err) {
    next(err);
  }
});

// 14. PATCH /materials/:id (A)
router.patch('/materials/:id', auth, requireAdmin, validate(updateMaterialSchema), async (req, res, next) => {
  try {
    const existing = await materialsRepo.findById(req.params.id);
    if (!existing) {
      throw NotFoundError('Material not found');
    }

    if (req.body.version !== undefined && existing.version !== req.body.version) {
      throw VersionConflictError('Material was modified by another user');
    }

    // deduct_by cannot change after material has any outgoing row
    if (req.body.deductBy && req.body.deductBy !== existing.deductBy) {
      const hasRows = await materialsRepo.hasOutgoingRows(req.params.id);
      if (hasRows) {
        throw ValidationError('Cannot change issue mode (deduct_by) after material has outgoing transactions');
      }
    }

    if (req.body.name && req.body.name !== existing.name) {
      const nameDuplicate = await materialsRepo.findByName(req.body.name);
      if (nameDuplicate && nameDuplicate.id !== req.params.id) {
        throw DuplicateError(`Material name '${req.body.name}' is already in use`);
      }
    }

    const { material, revision } = await withTransaction(async (tx) => {
      const updated = await materialsRepo.updateMaterial(req.params.id, {
        ...req.body,
        updatedBy: req.user.id,
      }, tx);

      const rev = await metaRepo.bumpRevision(tx);
      await auditRepo.createAuditEntry({
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'materials',
        entityId: req.params.id,
        before: mapMaterial(existing),
        after: mapMaterial(updated),
      }, tx);

      return { material: updated, revision: rev };
    });

    broadcast({
      type: 'changed',
      revision,
      entity: 'materials',
      material_id: material.id,
      by: req.user.id,
    });

    res.json(mapMaterial(material));
  } catch (err) {
    next(err);
  }
});

// 15. GET /materials/:id/ledger (S)
router.get('/materials/:id/ledger', auth, async (req, res, next) => {
  try {
    const ledger = await ledgerService.getMaterialLedger(req.params.id);
    res.json(ledger);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

