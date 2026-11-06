const { prisma } = require('../db');

async function listUnits(client = prisma) {
  return await client.unit.findMany({
    orderBy: { code: 'asc' },
  });
}

async function findById(id, client = prisma) {
  return await client.unit.findUnique({
    where: { id },
  });
}

async function findByCode(code, client = prisma) {
  return await client.unit.findUnique({
    where: { code: code.trim().toLowerCase() },
  });
}

async function createUnit(data, client = prisma) {
  return await client.unit.create({
    data: {
      code: data.code.trim().toLowerCase(),
      name: data.name.trim(),
      createdBy: data.createdBy || null,
      updatedBy: data.updatedBy || null,
      version: 1,
    },
  });
}

async function updateUnit(id, data, client = prisma) {
  return await client.unit.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      updatedBy: data.updatedBy || null,
      version: { increment: 1 },
    },
  });
}

module.exports = {
  listUnits,
  findById,
  findByCode,
  createUnit,
  updateUnit,
};

