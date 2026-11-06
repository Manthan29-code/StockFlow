const { prisma } = require('../db');

async function listMaterials(includeUnit = true, client = prisma) {
  return await client.material.findMany({
    include: {
      unit: includeUnit,
    },
    orderBy: { name: 'asc' },
  });
}

async function findById(id, includeUnit = true, client = prisma) {
  return await client.material.findUnique({
    where: { id },
    include: {
      unit: includeUnit,
    },
  });
}

async function findByName(name, client = prisma) {
  return await client.material.findUnique({
    where: { name: name.trim() },
    include: {
      unit: true,
    },
  });
}

async function createMaterial(data, client = prisma) {
  return await client.material.create({
    data: {
      name: data.name.trim(),
      unitId: data.unitId,
      deductBy: data.deductBy,
      specLabel: data.specLabel ? data.specLabel.trim() : null,
      notes: data.notes ? data.notes.trim() : null,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdBy: data.createdBy || null,
      updatedBy: data.updatedBy || null,
      version: 1,
    },
    include: {
      unit: true,
    },
  });
}

async function updateMaterial(id, data, client = prisma) {
  const updateData = {
    updatedBy: data.updatedBy || null,
    version: { increment: 1 },
  };

  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.unitId !== undefined) updateData.unitId = data.unitId;
  if (data.deductBy !== undefined) updateData.deductBy = data.deductBy;
  if (data.specLabel !== undefined) updateData.specLabel = data.specLabel ? data.specLabel.trim() : null;
  if (data.notes !== undefined) updateData.notes = data.notes ? data.notes.trim() : null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return await client.material.update({
    where: { id },
    data: updateData,
    include: {
      unit: true,
    },
  });
}

async function hasOutgoingRows(materialId, client = prisma) {
  const count = await client.outgoingTransaction.count({
    where: {
      incomingEntry: {
        materialId,
      },
    },
  });
  return count > 0;
}

module.exports = {
  listMaterials,
  findById,
  findByName,
  createMaterial,
  updateMaterial,
  hasOutgoingRows,
};

