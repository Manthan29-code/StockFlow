const { prisma } = require('../db');

async function listParties(client = prisma) {
  return await client.party.findMany({
    orderBy: { name: 'asc' },
  });
}

async function findById(id, client = prisma) {
  return await client.party.findUnique({
    where: { id },
  });
}

async function findByName(name, client = prisma) {
  return await client.party.findUnique({
    where: { name: name.trim() },
  });
}

async function createParty(data, client = prisma) {
  return await client.party.create({
    data: {
      name: data.name.trim(),
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdBy: data.createdBy || null,
      updatedBy: data.updatedBy || null,
      version: 1,
    },
  });
}

async function updateParty(id, data, client = prisma) {
  const updateData = {
    updatedBy: data.updatedBy || null,
    version: { increment: 1 },
  };

  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return await client.party.update({
    where: { id },
    data: updateData,
  });
}

module.exports = {
  listParties,
  findById,
  findByName,
  createParty,
  updateParty,
};

