const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const config = require('../src/config');
const { parseYYYYMMDDToDate } = require('../src/utils/dates');

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

/**
 * Searches for a backup JSON file from arguments, env, or common project locations.
 */
function findBackupFile() {
  const fileArg = process.argv.find((a) => !a.startsWith('--') && a.endsWith('.json'));
  if (fileArg && fs.existsSync(fileArg)) {
    return path.resolve(fileArg);
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
 * Generates seed SQL from a backup JSON file.
 */
function generateSqlFromBackup(filePath) {
  console.log(`[Seed] Generating SQL from backup file: ${filePath}`);
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

  const lines = [];
  lines.push('-- Clear existing records in reverse dependency order');
  lines.push('DELETE FROM "audit_log";');
  lines.push('DELETE FROM "bom_lines";');
  lines.push('DELETE FROM "outgoing_transactions";');
  lines.push('DELETE FROM "incoming_entries";');
  lines.push('DELETE FROM "products";');
  lines.push('DELETE FROM "parties";');
  lines.push('DELETE FROM "materials";');
  lines.push('DELETE FROM "units";');
  lines.push('DELETE FROM "users";');
  lines.push('');

  // 1. Meta
  const revision = String(backup.revision || 0);
  lines.push(`INSERT OR REPLACE INTO "meta" ("key", "value") VALUES ('revision', ${escapeSql(revision)});`);
  lines.push('');

  // 2. Users
  for (const u of users) {
    lines.push(`INSERT INTO "users" ("id", "username", "password_hash", "role", "is_active", "color", "created_at", "updated_at", "version") VALUES (${escapeSql(u.id)}, ${escapeSql(u.username.toLowerCase())}, ${escapeSql(u.passwordHash)}, ${escapeSql(u.role || 'staff')}, ${escapeSql(u.isActive !== undefined ? u.isActive : true)}, ${escapeSql(u.color || '#635BFF')}, ${escapeSql(u.createdAt ? new Date(u.createdAt) : new Date())}, ${escapeSql(u.updatedAt ? new Date(u.updatedAt) : new Date())}, ${escapeSql(u.version || 1)});`);
  }
  lines.push('');

  // 3. Units
  for (const u of units) {
    lines.push(`INSERT INTO "units" ("id", "code", "name", "created_at", "updated_at", "version") VALUES (${escapeSql(u.id)}, ${escapeSql(u.code)}, ${escapeSql(u.name)}, ${escapeSql(u.createdAt ? new Date(u.createdAt) : new Date())}, ${escapeSql(u.updatedAt ? new Date(u.updatedAt) : new Date())}, ${escapeSql(u.version || 1)});`);
  }
  lines.push('');

  // 4. Materials
  for (const m of materials) {
    lines.push(`INSERT INTO "materials" ("id", "name", "unit_id", "deduct_by", "spec_label", "is_active", "notes", "created_at", "updated_at", "version") VALUES (${escapeSql(m.id)}, ${escapeSql(m.name)}, ${escapeSql(m.unitId)}, ${escapeSql(m.deductBy)}, ${escapeSql(m.specLabel || null)}, ${escapeSql(m.isActive !== undefined ? m.isActive : true)}, ${escapeSql(m.notes || null)}, ${escapeSql(m.createdAt ? new Date(m.createdAt) : new Date())}, ${escapeSql(m.updatedAt ? new Date(m.updatedAt) : new Date())}, ${escapeSql(m.version || 1)});`);
  }
  lines.push('');

  // 5. Parties
  for (const p of parties) {
    lines.push(`INSERT INTO "parties" ("id", "name", "is_active", "created_at", "updated_at", "version") VALUES (${escapeSql(p.id)}, ${escapeSql(p.name)}, ${escapeSql(p.isActive !== undefined ? p.isActive : true)}, ${escapeSql(p.createdAt ? new Date(p.createdAt) : new Date())}, ${escapeSql(p.updatedAt ? new Date(p.updatedAt) : new Date())}, ${escapeSql(p.version || 1)});`);
  }
  lines.push('');

  // 6. Products
  for (const p of products) {
    lines.push(`INSERT INTO "products" ("id", "party_id", "name", "is_active", "notes", "created_at", "updated_at", "version") VALUES (${escapeSql(p.id)}, ${escapeSql(p.partyId)}, ${escapeSql(p.name)}, ${escapeSql(p.isActive !== undefined ? p.isActive : true)}, ${escapeSql(p.notes || null)}, ${escapeSql(p.createdAt ? new Date(p.createdAt) : new Date())}, ${escapeSql(p.updatedAt ? new Date(p.updatedAt) : new Date())}, ${escapeSql(p.version || 1)});`);
  }
  lines.push('');

  // 7. Incoming entries
  for (const e of incoming_entries) {
    const inDate = parseYYYYMMDDToDate(e.inDate);
    lines.push(`INSERT INTO "incoming_entries" ("id", "material_id", "in_date", "challan_no", "quantity", "supplier", "notes", "lock_seq", "created_at", "updated_at", "version") VALUES (${escapeSql(e.id)}, ${escapeSql(e.materialId)}, ${escapeSql(inDate)}, ${escapeSql(e.challanNo)}, ${escapeSql(e.quantity)}, ${escapeSql(e.supplier || null)}, ${escapeSql(e.notes || null)}, ${escapeSql(e.lockSeq || 0)}, ${escapeSql(e.createdAt ? new Date(e.createdAt) : new Date())}, ${escapeSql(e.updatedAt ? new Date(e.updatedAt) : new Date())}, ${escapeSql(e.version || 1)});`);
  }
  lines.push('');

  // 8. Outgoing transactions
  for (const r of outgoing_transactions) {
    const outDate = parseYYYYMMDDToDate(r.outDate);
    lines.push(`INSERT INTO "outgoing_transactions" ("id", "incoming_entry_id", "out_date", "challan_no", "row_no", "qty", "piece_weight", "spec_value", "total_weight", "deducted", "created_at", "updated_at", "version") VALUES (${escapeSql(r.id)}, ${escapeSql(r.incomingEntryId)}, ${escapeSql(outDate)}, ${escapeSql(r.challanNo)}, ${escapeSql(r.rowNo)}, ${escapeSql(r.qty)}, ${escapeSql(r.pieceWeight || null)}, ${escapeSql(r.specValue || null)}, ${escapeSql(r.totalWeight || null)}, ${escapeSql(r.deducted)}, ${escapeSql(r.createdAt ? new Date(r.createdAt) : new Date())}, ${escapeSql(r.updatedAt ? new Date(r.updatedAt) : new Date())}, ${escapeSql(r.version || 1)});`);
  }
  lines.push('');

  // 9. BOM lines
  for (const b of bom_lines) {
    lines.push(`INSERT INTO "bom_lines" ("id", "product_id", "material_id", "consumption", "spec_value", "created_at", "updated_at", "version") VALUES (${escapeSql(b.id)}, ${escapeSql(b.productId)}, ${escapeSql(b.materialId)}, ${escapeSql(b.consumption)}, ${escapeSql(b.specValue || null)}, ${escapeSql(b.createdAt ? new Date(b.createdAt) : new Date())}, ${escapeSql(b.updatedAt ? new Date(b.updatedAt) : new Date())}, ${escapeSql(b.version || 1)});`);
  }
  lines.push('');

  // 10. Audit logs
  for (const a of audit_log) {
    lines.push(`INSERT INTO "audit_log" ("id", "user_id", "action", "entity", "entity_id", "before", "after", "at") VALUES (${escapeSql(a.id)}, ${escapeSql(a.userId || null)}, ${escapeSql(a.action)}, ${escapeSql(a.entity)}, ${escapeSql(a.entityId ? String(a.entityId) : null)}, ${escapeSql(a.before ?? null)}, ${escapeSql(a.after ?? null)}, ${escapeSql(a.at ? new Date(a.at) : new Date())});`);
  }

  return lines.join('\n');
}

/**
 * Generates default minimal SQL (admin user, units, revision).
 */
function generateDefaultSql() {
  const adminUsername = (config.SEED_ADMIN_USERNAME || 'admin').toLowerCase();
  const adminPassword = config.SEED_ADMIN_PASSWORD || '123456';
  const passwordHash = bcrypt.hashSync(adminPassword, config.BCRYPT_ROUNDS || 10);
  const adminId = randomUUID();
  const unitKgId = randomUUID();
  const unitNosId = randomUUID();

  return `-- Default minimal seed
INSERT OR REPLACE INTO "meta" ("key", "value") VALUES ('revision', '0');

INSERT OR IGNORE INTO "units" ("id", "code", "name", "created_at", "updated_at", "version") VALUES
  (${escapeSql(unitKgId)}, 'kg', 'Kilograms', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1),
  (${escapeSql(unitNosId)}, 'nos', 'Numbers / Pieces', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1);

INSERT OR IGNORE INTO "users" ("id", "username", "password_hash", "role", "is_active", "color", "created_at", "updated_at", "version") VALUES
  (${escapeSql(adminId)}, ${escapeSql(adminUsername)}, ${escapeSql(passwordHash)}, 'admin', 1, '#635BFF', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1);
`;
}

async function main() {
  const isRemote = process.argv.includes('--remote');
  const backupFile = findBackupFile();

  let sqlContent;
  if (backupFile) {
    sqlContent = generateSqlFromBackup(backupFile);
  } else {
    sqlContent = generateDefaultSql();
  }

  const seedSqlPath = path.resolve(__dirname, 'seed.sql');
  fs.writeFileSync(seedSqlPath, sqlContent, 'utf8');
  console.log(`[Seed] Generated SQL file: ${seedSqlPath}`);

  // Also seed local SQLite if Prisma is available
  try {
    const { prisma } = require('../src/db');
    if (!backupFile) {
      const adminUsername = (config.SEED_ADMIN_USERNAME || 'admin').toLowerCase();
      const adminPassword = config.SEED_ADMIN_PASSWORD || '123456';
      const passwordHash = bcrypt.hashSync(adminPassword, config.BCRYPT_ROUNDS || 10);

      await prisma.meta.upsert({
        where: { key: 'revision' },
        update: {},
        create: { key: 'revision', value: '0' },
      });
      await prisma.unit.upsert({
        where: { code: 'kg' },
        update: {},
        create: { code: 'kg', name: 'Kilograms' },
      });
      await prisma.unit.upsert({
        where: { code: 'nos' },
        update: {},
        create: { code: 'nos', name: 'Numbers / Pieces' },
      });
      await prisma.user.upsert({
        where: { username: adminUsername },
        update: {},
        create: {
          username: adminUsername,
          passwordHash,
          role: 'admin',
          isActive: true,
          color: '#635BFF',
        },
      });
      console.log('[Seed] Local database (dev.db) seeded with admin user.');
    }
    await prisma.$disconnect();
  } catch (err) {
    // Ignore local db errors if only remote is needed
  }

  if (isRemote) {
    const dbName = config.CLOUDFLARE_D1_DATABASE_NAME || 'stock-flow';
    console.log(`[Seed] Applying seed SQL directly to Cloudflare D1 (${dbName}) via Wrangler...`);
    execSync(`npx wrangler d1 execute ${dbName} --remote --file=prisma/seed.sql`, {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
    });
    console.log(`[Seed] Successfully seeded Cloudflare D1 remote database '${dbName}'!`);
  } else {
    const dbName = config.CLOUDFLARE_D1_DATABASE_NAME || 'stock-flow';
    console.log(`
[Seed] Done! To apply this seed to your Cloudflare D1 remote database, run:
  npx wrangler d1 execute ${dbName} --remote --file=prisma/seed.sql

Or run seed with --remote flag:
  node prisma/seed.js --remote
`);
  }
}

main().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
