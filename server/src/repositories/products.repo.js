const { prisma } = require('../db');

async function listProducts(partyId = null, client = prisma) {
  const where = partyId ? { partyId } : {};
  return await client.product.findMany({
    where,
    include: {
      party: true,
      bomLines: {
        include: {
          material: {
            include: { unit: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
}

async function findById(id, includeBom = true, client = prisma) {
  return await client.product.findUnique({
    where: { id },
    include: {
      party: true,
      bomLines: includeBom
        ? {
            include: {
              material: {
                include: { unit: true },
              },
            },
          }
        : false,
    },
  });
}

async function findByPartyAndName(partyId, name, client = prisma) {
  return await client.product.findUnique({
    where: {
      partyId_name: {
        partyId,
        name: name.trim(),
      },
    },
    include: {
      party: true,
    },
  });
}

async function findByName(name, client = prisma) {
  return await client.product.findFirst({
    where: {
      name: { equals: name.trim(), mode: 'insensitive' },
    },
    include: {
      party: true,
    },
  });
}

async function createProduct(data, client = prisma) {
  return await client.product.create({
    data: {
      partyId: data.partyId,
      name: data.name.trim(),
      notes: data.notes ? data.notes.trim() : null,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdBy: data.createdBy || null,
      updatedBy: data.updatedBy || null,
      version: 1,
    },
    include: {
      party: true,
      bomLines: true,
    },
  });
}

async function updateProduct(id, data, client = prisma) {
  const updateData = {
    updatedBy: data.updatedBy || null,
    version: { increment: 1 },
  };

  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.partyId !== undefined) updateData.partyId = data.partyId;
  if (data.notes !== undefined) updateData.notes = data.notes ? data.notes.trim() : null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return await client.product.update({
    where: { id },
    data: updateData,
    include: {
      party: true,
    },
  });
}

async function deleteProduct(id, client = prisma) {
  await client.bomLine.deleteMany({
    where: { productId: id },
  });
  return await client.product.delete({
    where: { id },
  });
}

module.exports = {
  listProducts,
  findById,
  findByPartyAndName,
  findByName,
  createProduct,
  updateProduct,
  deleteProduct,
};

