const { PrismaClient } = require('@prisma/client');
const config = require('../config');

let prismaClientInstance = null;

/**
 * Initializes Prisma with Cloudflare D1 or local SQLite driver adapter.
 * @param {object} [d1Binding] - Optional Cloudflare D1 binding from env.DB
 */
function initPrisma(d1Binding) {
  const binding = d1Binding || globalThis.__D1_DB__;

  if (binding) {
    // Cloudflare D1 environment (e.g. Cloudflare Worker runtime)
    const { PrismaD1 } = require('@prisma/adapter-d1');
    const adapter = new PrismaD1(binding);
    prismaClientInstance = new PrismaClient({
      adapter,
      log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
    return prismaClientInstance;
  }

  // Node.js Express server using Prisma 7 libSQL adapter
  const { PrismaLibSql } = require('@prisma/adapter-libsql');
  const adapter = new PrismaLibSql({
    url: config.DATABASE_URL || 'file:./dev.db',
  });

  prismaClientInstance = new PrismaClient({
    adapter,
    log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
  return prismaClientInstance;
}

/**
 * Returns the active Prisma instance or initializes a default one.
 */
function getPrisma() {
  if (!prismaClientInstance) {
    return initPrisma();
  }
  return prismaClientInstance;
}

// Transparent Proxy so all existing `prisma.<model>.<method>()` calls route to the active client
const prisma = new Proxy({}, {
  get(target, prop) {
    const instance = getPrisma();
    const value = instance[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

module.exports = {
  prisma,
  initPrisma,
  getPrisma,
};
