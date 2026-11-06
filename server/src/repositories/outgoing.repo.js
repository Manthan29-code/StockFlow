const { prisma } = require('../db');
const { parseYYYYMMDDToDate } = require('../utils/dates');

async function findById(id, client = prisma) {
  return await client.outgoingTransaction.findUnique({
    where: { id },
    include: {
      incomingEntry: {
        include: {
          material: true,
        },
      },
    },
  });
}

async function listByEntry(incomingEntryId, client = prisma) {
  return await client.outgoingTransaction.findMany({
    where: { incomingEntryId },
    orderBy: [{ outDate: 'asc' }, { rowNo: 'asc' }],
  });
}

async function getMaxRowNo(incomingEntryId, client = prisma) {
  const aggregate = await client.outgoingTransaction.aggregate({
    where: { incomingEntryId },
    _max: { rowNo: true },
  });
  return aggregate._max.rowNo || 0;
}

async function createRow(data, client = prisma) {
  return await client.outgoingTransaction.create({
    data: {
      incomingEntryId: data.incomingEntryId,
      outDate: parseYYYYMMDDToDate(data.outDate),
      challanNo: data.challanNo.trim(),
      rowNo: data.rowNo,
      qty: data.qty,
      pieceWeight: data.pieceWeight !== undefined && data.pieceWeight !== null ? data.pieceWeight : null,
      specValue: data.specValue ? String(data.specValue).trim() : null,
      totalWeight: data.totalWeight !== undefined && data.totalWeight !== null ? data.totalWeight : null,
      deducted: data.deducted,
      createdBy: data.createdBy || null,
      updatedBy: data.updatedBy || null,
      version: 1,
    },
  });
}

async function updateRow(id, data, client = prisma) {
  const updateData = {
    updatedBy: data.updatedBy || null,
    version: { increment: 1 },
  };

  if (data.outDate !== undefined) updateData.outDate = parseYYYYMMDDToDate(data.outDate);
  if (data.challanNo !== undefined) updateData.challanNo = data.challanNo.trim();
  if (data.qty !== undefined) updateData.qty = data.qty;
  if (data.pieceWeight !== undefined) updateData.pieceWeight = data.pieceWeight;
  if (data.specValue !== undefined) updateData.specValue = data.specValue ? String(data.specValue).trim() : null;
  if (data.totalWeight !== undefined) updateData.totalWeight = data.totalWeight;
  if (data.deducted !== undefined) updateData.deducted = data.deducted;

  return await client.outgoingTransaction.update({
    where: { id },
    data: updateData,
  });
}

async function deleteRow(id, client = prisma) {
  return await client.outgoingTransaction.delete({
    where: { id },
  });
}

module.exports = {
  findById,
  listByEntry,
  getMaxRowNo,
  createRow,
  updateRow,
  deleteRow,
};

