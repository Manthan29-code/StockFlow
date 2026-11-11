const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Checks if the primary tables exist in the database.
 * If tables do not exist (brand new database), executes the migration SQL files
 * to automatically create all tables, foreign keys, and performance indexes.
 */
async function ensureDatabaseSchema() {
  const connectionString = config.DATABASE_URL;
  if (!connectionString) {
    logger.warn('[Schema] DATABASE_URL is not set.');
    return { initialized: false, error: 'DATABASE_URL is not configured' };
  }

  const client = new Client({
    connectionString,
    ssl: connectionString.includes('sslmode=require') || connectionString.includes('neon.tech')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    await client.connect();

    // Check if the primary table 'users' exists
    const checkRes = await client.query(`
      SELECT to_regclass('public.users') AS exists;
    `);

    const tableExists = checkRes.rows[0] && checkRes.rows[0].exists;

    if (!tableExists) {
      logger.info('[Schema] Fresh database detected. Automatically applying migration DDL...');

      const migrationsDir = path.resolve(__dirname, '../../prisma/migrations');
      if (fs.existsSync(migrationsDir)) {
        const dirs = fs.readdirSync(migrationsDir)
          .filter((d) => fs.statSync(path.join(migrationsDir, d)).isDirectory())
          .sort();

        for (const dir of dirs) {
          const sqlFile = path.join(migrationsDir, dir, 'migration.sql');
          if (fs.existsSync(sqlFile)) {
            logger.info(`[Schema] Applying DDL migration: ${dir}`);
            const sql = fs.readFileSync(sqlFile, 'utf8');
            await client.query(sql);
          }
        }
      }

      logger.info('[Schema] All tables, foreign keys, and indexes created successfully.');
      return { initialized: true, created: true };
    }

    return { initialized: true, created: false };
  } catch (err) {
    logger.error('[Schema] Failed to verify or initialize database schema:', err);
    throw err;
  } finally {
    try {
      await client.end();
    } catch (_) {}
  }
}

module.exports = {
  ensureDatabaseSchema,
};

