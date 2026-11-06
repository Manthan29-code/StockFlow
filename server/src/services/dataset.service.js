const { prisma } = require('../db');
const metaRepo = require('../repositories/meta.repo');
const {
  mapUser,
  mapUnit,
  mapMaterial,
  mapIncomingEntry,
  mapOutgoingTransaction,
  mapParty,
  mapProduct,
  mapBomLine,
  mapAuditLog,
} = require('../db/mappers');

/**
 * Builds the dataset JSON representation
 * @param {boolean} includeAdminData - true for /admin/backup, false for /dataset
 */
async function buildDataset(includeAdminData = false) {
  const revision = await metaRepo.getRevision();
  const exportedAt = new Date().toISOString();

  const [
    units,
    materials,
    incomingEntries,
    outgoingTransactions,
    parties,
    products,
    bomLines,
  ] = await Promise.all([
    prisma.unit.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.material.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.incomingEntry.findMany({ orderBy: [{ inDate: 'asc' }, { createdAt: 'asc' }] }),
    prisma.outgoingTransaction.findMany({ orderBy: [{ outDate: 'asc' }, { rowNo: 'asc' }] }),
    prisma.party.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.product.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.bomLine.findMany({ orderBy: { createdAt: 'asc' } }),
  ]);

  const data = {
    units: units.map(mapUnit),
    materials: materials.map(mapMaterial),
    incoming_entries: incomingEntries.map(mapIncomingEntry),
    outgoing_transactions: outgoingTransactions.map(mapOutgoingTransaction),
    parties: parties.map(mapParty),
    products: products.map(mapProduct),
    bom_lines: bomLines.map(mapBomLine),
  };

  if (includeAdminData) {
    const [users, auditLogs] = await Promise.all([
      prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.auditLog.findMany({ orderBy: { at: 'asc' } }),
    ]);

    // Users with passwordHash preserved for full backup/restore capability
    data.users = users.map((u) => ({
      ...u,
      createdAt: u.createdAt ? u.createdAt.toISOString() : null,
      updatedAt: u.updatedAt ? u.updatedAt.toISOString() : null,
    }));
    data.audit_log = auditLogs.map(mapAuditLog);
  }

  return {
    formatVersion: 1,
    exportedAt,
    revision,
    data,
  };
}

module.exports = {
  buildDataset,
};

