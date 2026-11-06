const bomRepo = require('../repositories/bom.repo');
const productsRepo = require('../repositories/products.repo');
const materialsRepo = require('../repositories/materials.repo');
const incomingRepo = require('../repositories/incoming.repo');
const auditRepo = require('../repositories/audit.repo');
const metaRepo = require('../repositories/meta.repo');
const { broadcast } = require('../realtime/broadcaster');
const { withTransaction } = require('../db/tx');
const {
  NotFoundError,
  ValidationError,
  DuplicateError,
  VersionConflictError,
} = require('../utils/errors');
const {
  calculateEntryLedger,
  calculateMaterialStock,
  calculateBomRequirements,
} = require('@stockflow/shared');
const { mapBomLine, formatDateToYYYYMMDD } = require('../db/mappers');

async function addBomLine(actorId, productId, data) {
  const product = await productsRepo.findById(productId, false);
  if (!product) {
    throw NotFoundError('Product not found');
  }

  const material = await materialsRepo.findById(data.materialId);
  if (!material) {
    throw NotFoundError('Material not found');
  }

  const existingDuplicate = await bomRepo.findDuplicateLine(
    productId,
    data.materialId,
    data.specValue
  );
  if (existingDuplicate) {
    throw DuplicateError(
      `BOM line for this material and specification '${data.specValue || 'default'}' already exists on this product`
    );
  }

  const { line, revision } = await withTransaction(async (tx) => {
    const created = await bomRepo.createLine({
      productId,
      materialId: data.materialId,
      consumption: data.consumption,
      specValue: data.specValue,
      createdBy: actorId,
      updatedBy: actorId,
    }, tx);

    const rev = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'CREATE',
      entity: 'bom_lines',
      entityId: created.id,
      after: mapBomLine(created),
    }, tx);

    return { line: created, revision: rev };
  });

  broadcast({
    type: 'changed',
    revision,
    entity: 'bom',
    by: actorId,
  });

  return mapBomLine(line);
}

async function editBomLine(actorId, id, data) {
  const existing = await bomRepo.findById(id);
  if (!existing) {
    throw NotFoundError('BOM line not found');
  }

  if (data.version !== undefined && existing.version !== data.version) {
    throw VersionConflictError('BOM line was modified by another user');
  }

  if (data.specValue !== undefined) {
    const duplicate = await bomRepo.findDuplicateLine(
      existing.productId,
      existing.materialId,
      data.specValue,
      id
    );
    if (duplicate) {
      throw DuplicateError('Another BOM line with this specification already exists on this product');
    }
  }

  const { updated, revision } = await withTransaction(async (tx) => {
    const res = await bomRepo.updateLine(id, {
      consumption: data.consumption,
      specValue: data.specValue,
      updatedBy: actorId,
    }, tx);

    const rev = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'UPDATE',
      entity: 'bom_lines',
      entityId: id,
      before: mapBomLine(existing),
      after: mapBomLine(res),
    }, tx);

    return { updated: res, revision: rev };
  });

  broadcast({
    type: 'changed',
    revision,
    entity: 'bom',
    by: actorId,
  });

  return mapBomLine(updated);
}

async function deleteBomLine(actorId, id) {
  const existing = await bomRepo.findById(id);
  if (!existing) {
    throw NotFoundError('BOM line not found');
  }

  const revision = await withTransaction(async (tx) => {
    await bomRepo.deleteLine(id, tx);
    const rev = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'DELETE',
      entity: 'bom_lines',
      entityId: id,
      before: mapBomLine(existing),
    }, tx);
    return rev;
  });

  broadcast({
    type: 'changed',
    revision,
    entity: 'bom',
    by: actorId,
  });

  return { success: true };
}

async function calculateRequirements(productId, productionQty) {
  const product = await productsRepo.findById(productId, true);
  if (!product) {
    throw NotFoundError('Product not found');
  }

  const bomLines = product.bomLines || [];
  const materialIds = [...new Set(bomLines.map((l) => l.materialId))];

  // Fetch stocks for required materials
  const stockByMaterialId = {};
  for (const mId of materialIds) {
    const material = await materialsRepo.findById(mId);
    const entries = await incomingRepo.listByMaterial(mId, true);
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
        material.deductBy
      );
      return { balance: ledger.finalBalance };
    });
    stockByMaterialId[mId] = calculateMaterialStock(entriesWithLedger);
  }

  const mappedLines = bomLines.map(mapBomLine);
  const requirements = calculateBomRequirements(mappedLines, productionQty, stockByMaterialId);

  return {
    productId,
    productName: product.name,
    productionQty: String(productionQty),
    requirements,
  };
}

module.exports = {
  addBomLine,
  editBomLine,
  deleteBomLine,
  calculateRequirements,
};

