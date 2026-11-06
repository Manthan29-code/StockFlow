const { prisma } = require('../db');

async function findById(id, client = prisma) {
  return await client.bomLine.findUnique({
    where: { id },
    include: {
      material: {
        include: { unit: true },
      },
      product: true,
    },
  });
}

async function listByProduct(productId, client = prisma) {
  return await client.bomLine.findMany({
    where: { productId },
    include: {
      material: {
        include: { unit: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

async function findDuplicateLine(productId, materialId, specValue, excludeId = null, client = prisma) {
  const normSpec = specValue ? String(specValue).trim() : null;
  const lines = await client.bomLine.findMany({
    where: {
      productId,
      materialId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });

  return lines.find((line) => {
    const lineSpec = line.specValue ? String(line.specValue).trim() : null;
    return lineSpec === normSpec;
  });
}

async function createLine(data, client = prisma) {
  return await client.bomLine.create({
    data: {
      productId: data.productId,
      materialId: data.materialId,
      consumption: data.consumption,
      specValue: data.specValue ? String(data.specValue).trim() : null,
      createdBy: data.createdBy || null,
      updatedBy: data.updatedBy || null,
      version: 1,
    },
    include: {
      material: {
        include: { unit: true },
      },
    },
  });
}

async function updateLine(id, data, client = prisma) {
  const updateData = {
    updatedBy: data.updatedBy || null,
    version: { increment: 1 },
  };

  if (data.consumption !== undefined) updateData.consumption = data.consumption;
  if (data.specValue !== undefined) updateData.specValue = data.specValue ? String(data.specValue).trim() : null;

  return await client.bomLine.update({
    where: { id },
    data: updateData,
    include: {
      material: {
        include: { unit: true },
      },
    },
  });
}

async function deleteLine(id, client = prisma) {
  return await client.bomLine.delete({
    where: { id },
  });
}

module.exports = {
  findById,
  listByProduct,
  findDuplicateLine,
  createLine,
  updateLine,
  deleteLine,
};

