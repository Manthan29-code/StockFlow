const bcrypt = require('bcryptjs');
const { prisma } = require('../src/db');
const config = require('../src/config');

async function main() {
  console.log('Starting seed...');

  // 1. Meta revision = 0
  await prisma.meta.upsert({
    where: { key: 'revision' },
    update: {},
    create: {
      key: 'revision',
      value: '0',
    },
  });
  console.log('Meta revision initialized.');

  // 2. Units: kg and nos
  const units = [
    { code: 'kg', name: 'Kilograms' },
    { code: 'nos', name: 'Numbers / Pieces' },
  ];

  for (const u of units) {
    await prisma.unit.upsert({
      where: { code: u.code },
      update: {},
      create: {
        code: u.code,
        name: u.name,
      },
    });
  }
  console.log('Units initialized (kg, nos).');

  // 3. First admin user
  const adminUsername = (config.SEED_ADMIN_USERNAME || 'admin').toLowerCase();
  const adminPassword = config.SEED_ADMIN_PASSWORD || 'change-me-now';
  const passwordHash = await bcrypt.hash(adminPassword, config.BCRYPT_ROUNDS || 12);

  const existingAdmin = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        username: adminUsername,
        passwordHash,
        role: 'admin',
        isActive: true,
        color: '#635BFF',
      },
    });
    console.log(`First admin user '${adminUsername}' created.`);
  } else {
    console.log(`Admin user '${adminUsername}' already exists.`);
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

