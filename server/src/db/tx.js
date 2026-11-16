const { prisma } = require('./index');

/**
 * Runs a callback inside a Prisma transaction, or sequentially on Prisma for Cloudflare D1
 * (Cloudflare D1 does not support interactive transactions `prisma.$transaction(async (tx) => ...)`).
 * 
 * @param {Function} callback - (tx) => Promise<any>
 * @param {Object} [options]
 * @returns {Promise<any>}
 */
async function withTransaction(callback, options = {}) {
  // Cloudflare D1 environment: interactive transactions are not supported by @prisma/adapter-d1.
  // Execute sequentially directly with prisma as the client.
  if (globalThis.__D1_DB__) {
    return await callback(prisma);
  }

  // Node.js / Local LibSQL environment: use native Prisma interactive transaction with fallback
  try {
    return await prisma.$transaction(async (tx) => {
      return await callback(tx);
    }, {
      maxWait: 5000,
      timeout: 10000,
      ...options,
    });
  } catch (err) {
    if (err && err.message && err.message.includes('Cloudflare D1 does not support interactive transactions')) {
      return await callback(prisma);
    }
    throw err;
  }
}

module.exports = {
  withTransaction,
};

