const { PrismaClient } = require('@prisma/client');
const config = require('../config');
const logger = require('../utils/logger');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.DATABASE_URL,
    },
  },
  log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = {
  prisma,
};

