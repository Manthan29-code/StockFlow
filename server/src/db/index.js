const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const config = require('../config');

const adapter = new PrismaPg({
  connectionString: config.DATABASE_URL,
  max: config.DB_POOL_MAX || 5,
});

const prisma = new PrismaClient({
  adapter,
  log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = {
  prisma,
};

