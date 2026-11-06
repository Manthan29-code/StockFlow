const { withTransaction } = require('../db/tx');
const materialsRepo = require('../repositories/materials.repo');
const incomingRepo = require('../repositories/incoming.repo');
const outgoingRepo = require('../repositories/outgoing.repo');
const partiesRepo = require('../repositories/parties.repo');
const productsRepo = require('../repositories/products.repo');
const bomRepo = require('../repositories/bom.repo');
const auditRepo = require('../repositories/audit.repo');
const metaRepo = require('../repositories/meta.repo');
const { broadcast } = require('../realtime/broadcaster');
const { NotFoundError, ValidationError, InsufficientBalanceError } = require('../utils/errors');
const { calculateDeducted, validateRunningBalances } = require('@stockflow/shared');

async function commitMaterialImport(actorId, materialId, entries) {
  const material = await materialsRepo.findById(materialId);
  if (!material) {
    throw NotFoundError('Material not found');
  }

  const revision = await withTransaction(async (tx) => {
    let createdEntriesCount = 0;
    let createdRowsCount = 0;

    for (const entryData of entries) {
      // Validate all outgoing rows for this entry
      const outgoingRows = entryData.outgoingRows || [];

      // Check dates
      for (const row of outgoingRows) {
        if (row.outDate < entryData.inDate) {
          throw ValidationError(`Outgoing date ${row.outDate} cannot be earlier than incoming date ${entryData.inDate}`);
        }
      }

      // Check running balance
      const validation = validateRunningBalances(
        entryData.quantity,
        outgoingRows,
        material.deductBy
      );

      if (!validation.valid) {
        throw InsufficientBalanceError(
          `Entry with Challan '${entryData.challanNo}' over-issues stock (min balance: ${validation.minBalance})`
        );
      }

      // Create incoming entry
      const createdEntry = await incomingRepo.createEntry({
        materialId,
        inDate: entryData.inDate,
        challanNo: entryData.challanNo,
        quantity: entryData.quantity,
        supplier: entryData.supplier,
        notes: entryData.notes,
        createdBy: actorId,
        updatedBy: actorId,
      }, tx);
      createdEntriesCount++;

      // Create outgoing rows
      let rowNoCounter = 1;
      for (const row of outgoingRows) {
        const { deducted, totalWeight } = calculateDeducted({
          deductBy: material.deductBy,
          qty: row.qty,
          pieceWeight: row.pieceWeight,
        });

        await outgoingRepo.createRow({
          incomingEntryId: createdEntry.id,
          outDate: row.outDate,
          challanNo: row.challanNo,
          rowNo: row.rowNo || rowNoCounter++,
          qty: row.qty,
          pieceWeight: row.pieceWeight,
          specValue: row.specValue,
          totalWeight,
          deducted,
          createdBy: actorId,
          updatedBy: actorId,
        }, tx);
        createdRowsCount++;
      }
    }

    const rev = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'IMPORT_MATERIAL',
      entity: 'materials',
      entityId: materialId,
      after: {
        materialId,
        materialName: material.name,
        entriesImported: createdEntriesCount,
        rowsImported: createdRowsCount,
      },
    }, tx);

    return rev;
  });

  broadcast({
    type: 'changed',
    revision,
    entity: 'materials',
    material_id: materialId,
    by: actorId,
  });

  return { success: true, revision };
}

async function commitBomImport(actorId, items) {
  const revision = await withTransaction(async (tx) => {
    let createdLinesCount = 0;
    let skippedDuplicatesCount = 0;

    for (const item of items) {
      const partyName = item.partyName.trim();
      const productName = item.productName.trim();

      // 1. Party
      let party = await partiesRepo.findByName(partyName, tx);
      if (!party) {
        party = await partiesRepo.createParty({
          name: partyName,
          createdBy: actorId,
          updatedBy: actorId,
        }, tx);
      }

      // 2. Product
      let product = await productsRepo.findByPartyAndName(party.id, productName, tx);
      if (!product) {
        product = await productsRepo.createProduct({
          partyId: party.id,
          name: productName,
          createdBy: actorId,
          updatedBy: actorId,
        }, tx);
      }

      // 3. BOM Line duplicate check
      const duplicate = await bomRepo.findDuplicateLine(
        product.id,
        item.materialId,
        item.specValue,
        null,
        tx
      );

      if (duplicate) {
        skippedDuplicatesCount++;
        continue;
      }

      await bomRepo.createLine({
        productId: product.id,
        materialId: item.materialId,
        consumption: item.consumption,
        specValue: item.specValue,
        createdBy: actorId,
        updatedBy: actorId,
      }, tx);
      createdLinesCount++;
    }

    const rev = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'IMPORT_BOM',
      entity: 'bom_lines',
      after: {
        linesImported: createdLinesCount,
        linesSkipped: skippedDuplicatesCount,
      },
    }, tx);

    return rev;
  });

  broadcast({
    type: 'changed',
    revision,
    entity: 'bom',
    by: actorId,
  });

  return { success: true, revision };
}

module.exports = {
  commitMaterialImport,
  commitBomImport,
};

