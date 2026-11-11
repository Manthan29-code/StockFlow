const { withTransaction } = require('../db/tx');
const metaRepo = require('../repositories/meta.repo');
const auditRepo = require('../repositories/audit.repo');
const { ensureDatabaseSchema } = require('./schema.service');
const { broadcast } = require('../realtime/broadcaster');
const { ValidationError } = require('../utils/errors');
const { parseYYYYMMDDToDate } = require('../utils/dates');

async function restoreBackup(actorId, backupPayload) {
  if (!backupPayload || backupPayload.formatVersion !== 1 || !backupPayload.data) {
    throw ValidationError('Invalid backup payload. formatVersion 1 is required.');
  }

  // Ensure tables and indexes exist on the database before restoring
  await ensureDatabaseSchema();

  const {
    users = [],
    units = [],
    materials = [],
    parties = [],
    products = [],
    incoming_entries = [],
    outgoing_transactions = [],
    bom_lines = [],
    audit_log = [],
  } = backupPayload.data;

  const currentRev = await metaRepo.getRevision();
  const targetRev = Math.max(currentRev + 1, (backupPayload.revision || 0) + 1);

  await withTransaction(async (tx) => {
    // 1. Delete in reverse foreign-key dependency order
    await tx.auditLog.deleteMany({});
    await tx.bomLine.deleteMany({});
    await tx.outgoingTransaction.deleteMany({});
    await tx.incomingEntry.deleteMany({});
    await tx.product.deleteMany({});
    await tx.party.deleteMany({});
    await tx.material.deleteMany({});
    await tx.unit.deleteMany({});
    await tx.user.deleteMany({});

    // 2. Insert in forward foreign-key order, preserving exact UUIDs
    // Users
    for (const u of users) {
      await tx.user.create({
        data: {
          id: u.id,
          username: u.username.toLowerCase(),
          passwordHash: u.passwordHash,
          role: u.role,
          isActive: u.isActive !== undefined ? u.isActive : true,
          color: u.color,
          createdBy: u.createdBy || null,
          updatedBy: u.updatedBy || null,
          createdAt: u.createdAt ? new Date(u.createdAt) : undefined,
          updatedAt: u.updatedAt ? new Date(u.updatedAt) : undefined,
          version: u.version || 1,
        },
      });
    }

    // Units
    for (const u of units) {
      await tx.unit.create({
        data: {
          id: u.id,
          code: u.code,
          name: u.name,
          createdBy: u.createdBy || null,
          updatedBy: u.updatedBy || null,
          createdAt: u.createdAt ? new Date(u.createdAt) : undefined,
          updatedAt: u.updatedAt ? new Date(u.updatedAt) : undefined,
          version: u.version || 1,
        },
      });
    }

    // Materials
    for (const m of materials) {
      await tx.material.create({
        data: {
          id: m.id,
          name: m.name,
          unitId: m.unitId,
          deductBy: m.deductBy,
          specLabel: m.specLabel || null,
          isActive: m.isActive !== undefined ? m.isActive : true,
          notes: m.notes || null,
          createdBy: m.createdBy || null,
          updatedBy: m.updatedBy || null,
          createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
          updatedAt: m.updatedAt ? new Date(m.updatedAt) : undefined,
          version: m.version || 1,
        },
      });
    }

    // Parties
    for (const p of parties) {
      await tx.party.create({
        data: {
          id: p.id,
          name: p.name,
          isActive: p.isActive !== undefined ? p.isActive : true,
          createdBy: p.createdBy || null,
          updatedBy: p.updatedBy || null,
          createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
          updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
          version: p.version || 1,
        },
      });
    }

    // Products
    for (const p of products) {
      await tx.product.create({
        data: {
          id: p.id,
          partyId: p.partyId,
          name: p.name,
          isActive: p.isActive !== undefined ? p.isActive : true,
          notes: p.notes || null,
          createdBy: p.createdBy || null,
          updatedBy: p.updatedBy || null,
          createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
          updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
          version: p.version || 1,
        },
      });
    }

    // Incoming entries
    for (const e of incoming_entries) {
      await tx.incomingEntry.create({
        data: {
          id: e.id,
          materialId: e.materialId,
          inDate: parseYYYYMMDDToDate(e.inDate),
          challanNo: e.challanNo,
          quantity: e.quantity,
          supplier: e.supplier || null,
          notes: e.notes || null,
          lockSeq: e.lockSeq || 0,
          createdBy: e.createdBy || null,
          updatedBy: e.updatedBy || null,
          createdAt: e.createdAt ? new Date(e.createdAt) : undefined,
          updatedAt: e.updatedAt ? new Date(e.updatedAt) : undefined,
          version: e.version || 1,
        },
      });
    }

    // Outgoing transactions
    for (const r of outgoing_transactions) {
      await tx.outgoingTransaction.create({
        data: {
          id: r.id,
          incomingEntryId: r.incomingEntryId,
          outDate: parseYYYYMMDDToDate(r.outDate),
          challanNo: r.challanNo,
          rowNo: r.rowNo,
          qty: r.qty,
          pieceWeight: r.pieceWeight ? r.pieceWeight : null,
          specValue: r.specValue || null,
          totalWeight: r.totalWeight ? r.totalWeight : null,
          deducted: r.deducted,
          createdBy: r.createdBy || null,
          updatedBy: r.updatedBy || null,
          createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : undefined,
          version: r.version || 1,
        },
      });
    }

    // BOM lines
    for (const b of bom_lines) {
      await tx.bomLine.create({
        data: {
          id: b.id,
          productId: b.productId,
          materialId: b.materialId,
          consumption: b.consumption,
          specValue: b.specValue || null,
          createdBy: b.createdBy || null,
          updatedBy: b.updatedBy || null,
          createdAt: b.createdAt ? new Date(b.createdAt) : undefined,
          updatedAt: b.updatedAt ? new Date(b.updatedAt) : undefined,
          version: b.version || 1,
        },
      });
    }

    // Audit logs
    for (const a of audit_log) {
      await tx.auditLog.create({
        data: {
          id: a.id,
          userId: a.userId || null,
          action: a.action,
          entity: a.entity,
          entityId: a.entityId ? String(a.entityId) : null,
          before: a.before ?? null,
          after: a.after ?? null,
          at: a.at ? new Date(a.at) : undefined,
        },
      });
    }

    // Set higher revision
    await metaRepo.setRevision(targetRev, tx);

    // Record restore action in audit log
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'RESTORE_BACKUP',
      entity: 'system',
      after: {
        formatVersion: backupPayload.formatVersion,
        exportedAt: backupPayload.exportedAt,
        restoredEntitiesCount: {
          users: users.length,
          units: units.length,
          materials: materials.length,
          incoming: incoming_entries.length,
          outgoing: outgoing_transactions.length,
          parties: parties.length,
          products: products.length,
          bomLines: bom_lines.length,
        },
      },
    }, tx);
  });

  broadcast({
    type: 'changed',
    revision: targetRev,
    entity: 'system',
    by: actorId,
  });

  return {
    success: true,
    revision: targetRev,
  };
}

module.exports = {
  restoreBackup,
};

