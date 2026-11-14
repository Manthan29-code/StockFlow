const { PrismaClient } = require('@prisma/client');
const config = require('../config');

let prisma;

// If a Cloudflare D1 database binding is passed (e.g. in Cloudflare Worker environment)
if (globalThis.__D1_DB__) {
  const { PrismaD1 } = require('@prisma/adapter-d1');
  const adapter = new PrismaD1(globalThis.__D1_DB__);
  prisma = new PrismaClient({
    adapter,
    log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
} else {
  // Standard SQLite connection for Node.js Express server
  prisma = new PrismaClient({
    log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

module.exports = {
  prisma,
};
