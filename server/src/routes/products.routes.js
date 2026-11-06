const express = require('express');
const router = express.Router();
const productsRepo = require('../repositories/products.repo');
const bomService = require('../services/bom.service');
const auditRepo = require('../repositories/audit.repo');
const metaRepo = require('../repositories/meta.repo');
const { broadcast } = require('../realtime/broadcaster');
const { withTransaction } = require('../db/tx');
const { auth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { createProductSchema, updateProductSchema } = require('../schemas/products.schema');
const { createBomLineSchema } = require('../schemas/bom.schema');
const { DuplicateError, NotFoundError, ValidationError, VersionConflictError } = require('../utils/errors');
const { mapProduct } = require('../db/mappers');

// 19. GET /products (S)
router.get('/products', auth, async (req, res, next) => {
  try {
    const products = await productsRepo.listProducts(req.query.party_id || req.query.partyId || null);
    res.json(products.map(mapProduct));
  } catch (err) {
    next(err);
  }
});

// 20. GET /products/:id (S)
router.get('/products/:id', auth, async (req, res, next) => {
  try {
    const product = await productsRepo.findById(req.params.id, true);
    if (!product) {
      throw NotFoundError('Product not found');
    }
    res.json(mapProduct(product));
  } catch (err) {
    next(err);
  }
});

// 21. POST /products (A)
router.post('/products', auth, requireAdmin, validate(createProductSchema), async (req, res, next) => {
  try {
    const existing = await productsRepo.findByPartyAndName(req.body.partyId, req.body.name);
    if (existing) {
      throw DuplicateError(`Product '${req.body.name}' already exists for this party`);
    }

    const { product, revision } = await withTransaction(async (tx) => {
      const created = await productsRepo.createProduct({
        ...req.body,
        createdBy: req.user.id,
        updatedBy: req.user.id,
      }, tx);

      const rev = await metaRepo.bumpRevision(tx);
      await auditRepo.createAuditEntry({
        userId: req.user.id,
        action: 'CREATE',
        entity: 'products',
        entityId: created.id,
        after: mapProduct(created),
      }, tx);

      return { product: created, revision: rev };
    });

    broadcast({
      type: 'changed',
      revision,
      entity: 'products',
      by: req.user.id,
    });

    res.status(201).json(mapProduct(product));
  } catch (err) {
    next(err);
  }
});

// 22. PATCH /products/:id (A)
router.patch('/products/:id', auth, requireAdmin, validate(updateProductSchema), async (req, res, next) => {
  try {
    const existing = await productsRepo.findById(req.params.id, false);
    if (!existing) {
      throw NotFoundError('Product not found');
    }

    if (req.body.version !== undefined && existing.version !== req.body.version) {
      throw VersionConflictError('Product was modified by another user');
    }

    const targetPartyId = req.body.partyId || existing.partyId;
    const targetName = req.body.name || existing.name;

    if (targetPartyId !== existing.partyId || targetName !== existing.name) {
      const duplicate = await productsRepo.findByPartyAndName(targetPartyId, targetName);
      if (duplicate && duplicate.id !== req.params.id) {
        throw DuplicateError(`Product '${targetName}' already exists for this party`);
      }
    }

    const { product, revision } = await withTransaction(async (tx) => {
      const updated = await productsRepo.updateProduct(req.params.id, {
        ...req.body,
        updatedBy: req.user.id,
      }, tx);

      const rev = await metaRepo.bumpRevision(tx);
      await auditRepo.createAuditEntry({
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'products',
        entityId: req.params.id,
        before: mapProduct(existing),
        after: mapProduct(updated),
      }, tx);

      return { product: updated, revision: rev };
    });

    broadcast({
      type: 'changed',
      revision,
      entity: 'products',
      by: req.user.id,
    });

    res.json(mapProduct(product));
  } catch (err) {
    next(err);
  }
});

// 23. GET /products/:id/requirement?qty=100 (S)
router.get('/products/:id/requirement', auth, async (req, res, next) => {
  try {
    const qty = req.query.qty || req.query.quantity;
    if (!qty || isNaN(Number(qty)) || Number(qty) <= 0) {
      throw ValidationError('A valid positive numeric qty query parameter is required (e.g. ?qty=100)');
    }

    const result = await bomService.calculateRequirements(req.params.id, qty);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 24. POST /products/:id/bom-lines (A)
router.post('/products/:id/bom-lines', auth, requireAdmin, validate(createBomLineSchema), async (req, res, next) => {
  try {
    const line = await bomService.addBomLine(req.user.id, req.params.id, req.body);
    res.status(201).json(line);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

