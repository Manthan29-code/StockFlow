const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { prisma } = require('../../src/db');
const config = require('../../src/config');
const { ROLES } = require('@stockflow/shared');

let adminUser = null;
let staffUser = null;
let adminToken = null;
let staffToken = null;

async function clearDatabase() {
  await prisma.auditLog.deleteMany({});
  await prisma.bomLine.deleteMany({});
  await prisma.outgoingTransaction.deleteMany({});
  await prisma.incomingEntry.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.party.deleteMany({});
  await prisma.material.deleteMany({});
  await prisma.unit.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.meta.upsert({
    where: { key: 'revision' },
    update: { value: '0' },
    create: { key: 'revision', value: '0' },
  });
}

async function setupTestAuth() {
  const hash = await bcrypt.hash('password123', 4);

  adminUser = await prisma.user.upsert({
    where: { username: 'testadmin' },
    update: { passwordHash: hash, role: ROLES.ADMIN, isActive: true },
    create: {
      username: 'testadmin',
      passwordHash: hash,
      role: ROLES.ADMIN,
      isActive: true,
      color: '#635BFF',
    },
  });

  staffUser = await prisma.user.upsert({
    where: { username: 'teststaff' },
    update: { passwordHash: hash, role: ROLES.STAFF, isActive: true },
    create: {
      username: 'teststaff',
      passwordHash: hash,
      role: ROLES.STAFF,
      isActive: true,
      color: '#00D4B2',
    },
  });

  adminToken = jwt.sign({ userId: adminUser.id }, config.JWT_SECRET, { expiresIn: '1d' });
  staffToken = jwt.sign({ userId: staffUser.id }, config.JWT_SECRET, { expiresIn: '1d' });

  // Seed default units safely with upsert
  await prisma.unit.upsert({
    where: { code: 'kg' },
    update: {},
    create: { code: 'kg', name: 'Kilograms' },
  });

  await prisma.unit.upsert({
    where: { code: 'nos' },
    update: {},
    create: { code: 'nos', name: 'Pieces' },
  });

  return {
    adminUser,
    staffUser,
    adminToken,
    staffToken,
  };
}

module.exports = {
  prisma,
  clearDatabase,
  setupTestAuth,
  getAdminToken: () => adminToken,
  getStaffToken: () => staffToken,
  getAdminUser: () => adminUser,
  getStaffUser: () => staffUser,
};
