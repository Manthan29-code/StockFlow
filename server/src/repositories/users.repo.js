const { prisma } = require('../db');

const PALETTE = [
  '#635BFF',
  '#00D4B2',
  '#FF9900',
  '#FF4F81',
  '#32D583',
  '#7F56D9',
  '#0BA5EC',
  '#F04438',
];

function getRandomColor() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

async function findById(id, client = prisma) {
  return await client.user.findUnique({
    where: { id },
  });
}

async function findByUsername(username, client = prisma) {
  return await client.user.findUnique({
    where: { username: username.toLowerCase() },
  });
}

async function listUsers(client = prisma) {
  return await client.user.findMany({
    orderBy: { createdAt: 'asc' },
  });
}

async function createUser(data, client = prisma) {
  return await client.user.create({
    data: {
      username: data.username.toLowerCase(),
      passwordHash: data.passwordHash,
      role: data.role || 'staff',
      isActive: data.isActive !== undefined ? data.isActive : true,
      color: data.color || getRandomColor(),
      createdBy: data.createdBy || null,
      updatedBy: data.updatedBy || null,
    },
  });
}

async function updateUser(id, data, client = prisma) {
  const updateData = { ...data };
  if (updateData.username) {
    updateData.username = updateData.username.toLowerCase();
  }
  return await client.user.update({
    where: { id },
    data: updateData,
  });
}

async function countActiveAdmins(client = prisma) {
  return await client.user.count({
    where: {
      role: 'admin',
      isActive: true,
    },
  });
}

module.exports = {
  PALETTE,
  findById,
  findByUsername,
  listUsers,
  createUser,
  updateUser,
  countActiveAdmins,
};

