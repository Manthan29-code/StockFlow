const materialsRepo = require('../repositories/materials.repo');
const incomingRepo = require('../repositories/incoming.repo');
const usersRepo = require('../repositories/users.repo');
const {
  calculateEntryLedger,
  calculateMaterialStock,
  ENTRY_STATUS,
} = require('@stockflow/shared');
const {
  mapMaterial,
  mapIncomingEntry,
  mapOutgoingTransaction,
  formatDateToYYYYMMDD,
  mapUserBadge,
} = require('../db/mappers');
const { NotFoundError } = require('../utils/errors');

async function getMaterialLedger(materialId) {
  const material = await materialsRepo.findById(materialId);
  if (!material) {
    throw NotFoundError('Material not found');
  }

  const incomingEntries = await incomingRepo.listByMaterial(materialId, true);
  const users = await usersRepo.listUsers();
  const userMap = new Map(users.map((u) => [u.id, mapUserBadge(u)]));

  const entriesWithLedger = incomingEntries.map((entry) => {
    const rawRows = entry.outgoingRows || [];
    const ledger = calculateEntryLedger(
      { quantity: entry.quantity.toString() },
      rawRows.map((r) => ({
        id: r.id,
        incomingEntryId: r.incomingEntryId,
        outDate: formatDateToYYYYMMDD(r.outDate),
        challanNo: r.challanNo,
        rowNo: r.rowNo,
        qty: r.qty.toString(),
        pieceWeight: r.pieceWeight ? r.pieceWeight.toString() : null,
        specValue: r.specValue,
        totalWeight: r.totalWeight ? r.totalWeight.toString() : null,
        deducted: r.deducted.toString(),
        version: r.version,
        createdBy: r.createdBy,
        updatedBy: r.updatedBy,
        createdAt: r.createdAt ? r.createdAt.toISOString() : null,
        updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
        created_by: userMap.get(r.createdBy) || null,
        updated_by: userMap.get(r.updatedBy) || null,
      })),
      material.deductBy
    );

    return {
      ...mapIncomingEntry(entry),
      created_by: userMap.get(entry.createdBy) || null,
      updated_by: userMap.get(entry.updatedBy) || null,
      outgoingRows: ledger.rows,
      balance: ledger.finalBalance,
      finalBalance: ledger.finalBalance,
      status: ledger.status,
      totalDeducted: ledger.totalDeducted,
    };
  });

  const totalStock = calculateMaterialStock(entriesWithLedger);

  return {
    material: mapMaterial(material),
    totalStock,
    entries: entriesWithLedger,
  };
}

async function getStockSummary() {
  const materials = await materialsRepo.listMaterials(true);
  const allEntries = await incomingRepo.listByMaterial(null, true);

  // Group entries by materialId
  const entriesByMaterial = new Map();
  for (const m of materials) {
    entriesByMaterial.set(m.id, []);
  }

  for (const entry of allEntries) {
    if (entriesByMaterial.has(entry.materialId)) {
      entriesByMaterial.get(entry.materialId).push(entry);
    }
  }

  const summaries = materials.map((material) => {
    const entries = entriesByMaterial.get(material.id) || [];
    let openEntriesCount = 0;

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

      if (ledger.status !== ENTRY_STATUS.CLOSED) {
        openEntriesCount++;
      }

      return {
        balance: ledger.finalBalance,
      };
    });

    const totalStock = calculateMaterialStock(entriesWithLedger);

    return {
      material: mapMaterial(material),
      totalStock,
      openEntriesCount,
      totalEntriesCount: entries.length,
    };
  });

  return summaries;
}

module.exports = {
  getMaterialLedger,
  getStockSummary,
};

