const { PrismaClient } = require('@prisma/client');
const config = require('../config');

let prisma;

if (globalThis.__D1_DB__) {
  // Cloudflare D1 environment (e.g. Cloudflare Worker runtime)
  const { PrismaD1 } = require('@prisma/adapter-d1');
  const adapter = new PrismaD1(globalThis.__D1_DB__);
  prisma = new PrismaClient({
    adapter,
    log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
} else {
  // Node.js Express server using Prisma 7 libSQL adapter
  const { PrismaLibSql } = require('@prisma/adapter-libsql');

  const adapter = new PrismaLibSql({
    url: config.DATABASE_URL || 'file:./dev.db',
  });

  prisma = new PrismaClient({
    adapter,
    log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

module.exports = {
  prisma,
};
