const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { prisma } = require('../src/db');
const config = require('../src/config');
const { parseYYYYMMDDToDate } = require('../src/utils/dates');

/**
 * Searches for a backup JSON file from arguments, env, or common project locations.
 */
function findBackupFile() {
  if (process.argv[2] && fs.existsSync(process.argv[2])) {
    return path.resolve(process.argv[2]);
  }
  if (process.env.BACKUP_FILE && fs.existsSync(process.env.BACKUP_FILE)) {
    return path.resolve(process.env.BACKUP_FILE);
  }
  const searchPaths = [
    path.resolve(__dirname, '../../inventory-latest.json'),
    path.resolve(__dirname, '../inventory-latest.json'),
    path.resolve(process.cwd(), 'inventory-latest.json'),
    path.resolve(process.cwd(), '../inventory-latest.json'),
  ];
  for (const p of searchPaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Seeds the full database from a JSON backup file (formatVersion: 1)
 */
async function seedFromBackup(filePath) {
  console.log(`[Seed] Loading backup file: ${filePath}`);
  const raw = fs.readFileSync(filePath, 'utf8');
  const backup = JSON.parse(raw);

  if (!backup || !backup.data) {
    throw new Error('Invalid backup file structure: missing data payload.');
  }

  const {
    users = [],
    units = [],
    materials = [],
    parties = [],
    products = [],
    incoming_entries = [],
    outgoing_transactions = [],
    bom_lines = [],
    audit_log = [],
  } = backup.data;

  console.log(`[Seed] Backup content:
  - Users: ${users.length}
  - Units: ${units.length}
  - Materials: ${materials.length}
  - Parties: ${parties.length}
  - Products: ${products.length}
  - Incoming Entries: ${incoming_entries.length}
  - Outgoing Transactions: ${outgoing_transactions.length}
  - BOM Lines: ${bom_lines.length}
  - Audit Logs: ${audit_log.length}`);

  console.log('[Seed] Clearing existing records in reverse dependency order...');
  await prisma.auditLog.deleteMany({});
  await prisma.bomLine.deleteMany({});
  await prisma.outgoingTransaction.deleteMany({});
  await prisma.incomingEntry.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.party.deleteMany({});
  await prisma.material.deleteMany({});
  await prisma.unit.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Meta revision
  const revision = String(backup.revision || 0);
  await prisma.meta.upsert({
    where: { key: 'revision' },
    update: { value: revision },
    create: { key: 'revision', value: revision },
  });

  // 2. Users
  console.log('[Seed] Seeding users...');
  for (const u of users) {
    await prisma.user.create({
      data: {
        id: u.id,
        username: u.username.toLowerCase(),
        passwordHash: u.passwordHash,
        role: u.role || 'staff',
        isActive: u.isActive !== undefined ? u.isActive : true,
        color: u.color || '#635BFF',
        createdBy: u.createdBy || null,
        updatedBy: u.updatedBy || null,
        createdAt: u.createdAt ? new Date(u.createdAt) : undefined,
        updatedAt: u.updatedAt ? new Date(u.updatedAt) : undefined,
        version: u.version || 1,
      },
    });
  }

  // 3. Units
  console.log('[Seed] Seeding units...');
  for (const u of units) {
    await prisma.unit.create({
      data: {
        id: u.id,
        code: u.code,
        name: u.name,
        createdBy: u.createdBy || null,
        updatedBy: u.updatedBy || null,
        createdAt: u.createdAt ? new Date(u.createdAt) : undefined,
        updatedAt: u.updatedAt ? new Date(u.updatedAt) : undefined,
        version: u.version || 1,
      },
    });
  }

  // 4. Materials
  console.log('[Seed] Seeding materials...');
  for (const m of materials) {
    await prisma.material.create({
      data: {
        id: m.id,
        name: m.name,
        unitId: m.unitId,
        deductBy: m.deductBy,
        specLabel: m.specLabel || null,
        isActive: m.isActive !== undefined ? m.isActive : true,
        notes: m.notes || null,
        createdBy: m.createdBy || null,
        updatedBy: m.updatedBy || null,
        createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
        updatedAt: m.updatedAt ? new Date(m.updatedAt) : undefined,
        version: m.version || 1,
      },
    });
  }

  // 5. Parties
  console.log('[Seed] Seeding parties...');
  for (const p of parties) {
    await prisma.party.create({
      data: {
        id: p.id,
        name: p.name,
        isActive: p.isActive !== undefined ? p.isActive : true,
        createdBy: p.createdBy || null,
        updatedBy: p.updatedBy || null,
        createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
        version: p.version || 1,
      },
    });
  }

  // 6. Products
  console.log('[Seed] Seeding products...');
  for (const p of products) {
    await prisma.product.create({
      data: {
        id: p.id,
        partyId: p.partyId,
        name: p.name,
        isActive: p.isActive !== undefined ? p.isActive : true,
        notes: p.notes || null,
        createdBy: p.createdBy || null,
        updatedBy: p.updatedBy || null,
        createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
        version: p.version || 1,
      },
    });
  }

  // 7. Incoming entries
  console.log('[Seed] Seeding incoming entries...');
  for (const e of incoming_entries) {
    await prisma.incomingEntry.create({
      data: {
        id: e.id,
        materialId: e.materialId,
        inDate: parseYYYYMMDDToDate(e.inDate),
        challanNo: e.challanNo,
        quantity: e.quantity,
        supplier: e.supplier || null,
        notes: e.notes || null,
        lockSeq: e.lockSeq || 0,
        createdBy: e.createdBy || null,
        updatedBy: e.updatedBy || null,
        createdAt: e.createdAt ? new Date(e.createdAt) : undefined,
        updatedAt: e.updatedAt ? new Date(e.updatedAt) : undefined,
        version: e.version || 1,
      },
    });
  }

  // 8. Outgoing transactions
  console.log('[Seed] Seeding outgoing transactions...');
  for (const r of outgoing_transactions) {
    await prisma.outgoingTransaction.create({
      data: {
        id: r.id,
        incomingEntryId: r.incomingEntryId,
        outDate: parseYYYYMMDDToDate(r.outDate),
        challanNo: r.challanNo,
        rowNo: r.rowNo,
        qty: r.qty,
        pieceWeight: r.pieceWeight ? r.pieceWeight : null,
        specValue: r.specValue || null,
        totalWeight: r.totalWeight ? r.totalWeight : null,
        deducted: r.deducted,
        createdBy: r.createdBy || null,
        updatedBy: r.updatedBy || null,
        createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
        updatedAt: r.updatedAt ? new Date(r.updatedAt) : undefined,
        version: r.version || 1,
      },
    });
  }

  // 9. BOM lines
  console.log('[Seed] Seeding BOM lines...');
  for (const b of bom_lines) {
    await prisma.bomLine.create({
      data: {
        id: b.id,
        productId: b.productId,
        materialId: b.materialId,
        consumption: b.consumption,
        specValue: b.specValue || null,
        createdBy: b.createdBy || null,
        updatedBy: b.updatedBy || null,
        createdAt: b.createdAt ? new Date(b.createdAt) : undefined,
        updatedAt: b.updatedAt ? new Date(b.updatedAt) : undefined,
        version: b.version || 1,
      },
    });
  }

  // 10. Audit logs
  if (audit_log.length > 0) {
    console.log('[Seed] Seeding audit logs...');
    for (const a of audit_log) {
      await prisma.auditLog.create({
        data: {
          id: a.id,
          userId: a.userId || null,
          action: a.action,
          entity: a.entity,
          entityId: a.entityId ? String(a.entityId) : null,
          before: a.before ?? null,
          after: a.after ?? null,
          at: a.at ? new Date(a.at) : undefined,
        },
      });
    }
  }

  console.log('[Seed] All data seeded successfully from backup!');
}

/**
 * Seeds default minimal data (meta revision, default units, first admin)
 */
async function seedDefault() {
  console.log('[Seed] Initializing default seed data...');

  // 1. Meta revision = 0
  await prisma.meta.upsert({
    where: { key: 'revision' },
    update: {},
    create: {
      key: 'revision',
      value: '0',
    },
  });
  console.log('[Seed] Meta revision initialized.');

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
  console.log('[Seed] Units initialized (kg, nos).');

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
    console.log(`[Seed] First admin user '${adminUsername}' created.`);
  } else {
    console.log(`[Seed] Admin user '${adminUsername}' already exists.`);
  }

  console.log('[Seed] Default seed completed successfully.');
}

async function main() {
  const backupFile = findBackupFile();
  if (backupFile) {
    await seedFromBackup(backupFile);
  } else {
    await seedDefault();
  }
}

main()
  .catch((e) => {
    console.error('[Seed] Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
