const { prisma } = require('../db');

async function createAuditEntry({ userId, action, entity, entityId, before, after }, client = prisma) {
  return await client.auditLog.create({
    data: {
      userId: userId || null,
      action,
      entity,
      entityId: entityId ? String(entityId) : null,
      before: before ?? null,
      after: after ?? null,
    },
  });
}

async function listAuditLogs({ entity, userId, limit = 50, offset = 0 }, client = prisma) {
  const where = {};
  if (entity) where.entity = entity;
  if (userId) where.userId = userId;

  return await client.auditLog.findMany({
    where,
    orderBy: { at: 'desc' },
    take: limit,
    skip: offset,
  });
}

async function countAuditLogs({ entity, userId }, client = prisma) {
  const where = {};
  if (entity) where.entity = entity;
  if (userId) where.userId = userId;

  return await client.auditLog.count({ where });
}

module.exports = {
  createAuditEntry,
  listAuditLogs,
  countAuditLogs,
};

