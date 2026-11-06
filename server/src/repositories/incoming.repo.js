const { prisma } = require('../db');
const { parseYYYYMMDDToDate } = require('../utils/dates');

async function findById(id, includeOutgoing = false, client = prisma) {
  return await client.incomingEntry.findUnique({
    where: { id },
    include: {
      material: true,
      outgoingRows: includeOutgoing
        ? {
            orderBy: [{ outDate: 'asc' }, { rowNo: 'asc' }],
          }
        : false,
    },
  });
}

async function listByMaterial(materialId, includeOutgoing = false, client = prisma) {
  const where = materialId ? { materialId } : {};
  return await client.incomingEntry.findMany({
    where,
    include: {
      material: {
        include: { unit: true },
      },
      outgoingRows: includeOutgoing
        ? {
            orderBy: [{ outDate: 'asc' }, { rowNo: 'asc' }],
          }
        : false,
    },
    orderBy: [{ inDate: 'asc' }, { createdAt: 'asc' }],
  });
}

async function lockEntry(id, client = prisma) {
  return await client.incomingEntry.update({
    where: { id },
    data: {
      lockSeq: { increment: 1 },
    },
    include: {
      material: true,
      outgoingRows: {
        orderBy: [{ outDate: 'asc' }, { rowNo: 'asc' }],
      },
    },
  });
}

async function createEntry(data, client = prisma) {
  return await client.incomingEntry.create({
    data: {
      materialId: data.materialId,
      inDate: parseYYYYMMDDToDate(data.inDate),
      challanNo: data.challanNo.trim(),
      quantity: data.quantity,
      supplier: data.supplier ? data.supplier.trim() : null,
      notes: data.notes ? data.notes.trim() : null,
      lockSeq: 0,
      createdBy: data.createdBy || null,
      updatedBy: data.updatedBy || null,
      version: 1,
    },
    include: {
      material: {
        include: { unit: true },
      },
      outgoingRows: true,
    },
  });
}

async function updateEntry(id, data, client = prisma) {
  const updateData = {
    updatedBy: data.updatedBy || null,
    version: { increment: 1 },
  };

  if (data.inDate !== undefined) updateData.inDate = parseYYYYMMDDToDate(data.inDate);
  if (data.challanNo !== undefined) updateData.challanNo = data.challanNo.trim();
  if (data.quantity !== undefined) updateData.quantity = data.quantity;
  if (data.materialId !== undefined) updateData.materialId = data.materialId;
  if (data.supplier !== undefined) updateData.supplier = data.supplier ? data.supplier.trim() : null;
  if (data.notes !== undefined) updateData.notes = data.notes ? data.notes.trim() : null;

  return await client.incomingEntry.update({
    where: { id },
    data: updateData,
    include: {
      material: {
        include: { unit: true },
      },
      outgoingRows: {
        orderBy: [{ outDate: 'asc' }, { rowNo: 'asc' }],
      },
    },
  });
}

async function deleteEntry(id, client = prisma) {
  return await client.incomingEntry.delete({
    where: { id },
  });
}

async function countByMaterialAndChallan(materialId, challanNo, excludeId = null, client = prisma) {
  const where = {
    materialId,
    challanNo: challanNo.trim(),
  };
  if (excludeId) {
    where.id = { not: excludeId };
  }
  return await client.incomingEntry.count({ where });
}

module.exports = {
  findById,
  listByMaterial,
  lockEntry,
  createEntry,
  updateEntry,
  deleteEntry,
  countByMaterialAndChallan,
};

