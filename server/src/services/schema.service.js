const { prisma } = require('../db');
const logger = require('../utils/logger');

/**
 * Checks if the primary tables exist in the database.
 * Compatible with SQLite and Cloudflare D1.
 */
async function ensureDatabaseSchema() {
  try {
    // Check if the primary table 'users' exists and can be queried
    await prisma.user.findFirst({ select: { id: true } });
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
