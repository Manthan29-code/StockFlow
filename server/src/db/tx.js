const { prisma } = require('./index');

/**
 * Runs a callback inside a Prisma interactive transaction
 * @param {Function} callback - (tx) => Promise<any>
 * @param {Object} [options]
 * @returns {Promise<any>}
 */
async function withTransaction(callback, options = {}) {
  return await prisma.$transaction(async (tx) => {
    return await callback(tx);
  }, {
    maxWait: 5000,
    timeout: 10000,
    ...options,
  });
}

module.exports = {
  withTransaction,
};

