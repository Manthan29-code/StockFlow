const { prisma } = require('../db');
const logger = require('../utils/logger');

let fs;
let path;
try {
  fs = require('fs');
  path = require('path');
} catch (_) {
  // fs/path may be unavailable in strict edge runtimes
}

/**
 * Checks if the primary tables exist in the database.
 * If tables do not exist in local development, executes 0001_init.sql
 * to automatically create all tables, relations, and unique constraints.
 */
async function ensureDatabaseSchema() {
  try {
    // Check if table 'users' exists using sqlite_master (does not throw an error if missing)
    const tables = await prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users';"
    );

    const tableExists = Array.isArray(tables) && tables.length > 0;

    if (!tableExists) {
      if (fs && path && !globalThis.__D1_DB__) {
        logger.info('[Schema] Fresh local database detected. Automatically applying migration DDL...');
        const sqlFile = path.resolve(__dirname, '../../migrations/0001_init.sql');
        if (fs.existsSync(sqlFile)) {
          const sqlContent = fs.readFileSync(sqlFile, 'utf8');
          const statements = sqlContent
            .split(';')
            .map((s) => s.replace(/--.*$/gm, '').trim())
            .filter((s) => s.length > 0);

          for (const stmt of statements) {
            await prisma.$executeRawUnsafe(stmt);
          }
          logger.info(`[Schema] All ${statements.length} tables and constraints auto-created successfully.`);
          return { initialized: true, created: true };
        }
      } else {
        logger.warn('[Schema] Tables not found. In Cloudflare D1, apply migrations using: npx wrangler d1 migrations apply <db> --remote');
        return { initialized: false, error: 'D1 tables not migrated' };
      }
    }

    logger.info('[Schema] Database tables verified successfully.');
    return { initialized: true, created: false };
  } catch (err) {
    logger.warn('[Schema] Table check returned: ' + err.message);
    return { initialized: false, error: err.message };
  }
}

module.exports = {
  ensureDatabaseSchema,
};
