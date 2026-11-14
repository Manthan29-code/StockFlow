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
  // Node.js environment (Express Server) using the official SQLite driver adapter
  const { PrismaLibSQL } = require('@prisma/adapter-libsql');
  const { createClient } = require('@libsql/client');

  const libsql = createClient({
    url: config.DATABASE_URL || 'file:./dev.db',
  });
  const adapter = new PrismaLibSQL(libsql);

  prisma = new PrismaClient({
    adapter,
    log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

module.exports = {
  prisma,
};
