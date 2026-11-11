const http = require('http');
const app = require('./app');
const config = require('./config');
const { initWebSocketServer } = require('./realtime/wsServer');
const { ensureDatabaseSchema } = require('./services/schema.service');
const { prisma } = require('./db');
const logger = require('./utils/logger');

const server = http.createServer(app);

// Attach WebSocket server on /ws
const wss = initWebSocketServer(server);

const PORT = config.PORT || 3000;

server.listen(PORT, async () => {
  logger.info(`StockFlow server listening on port ${PORT} [env: ${config.NODE_ENV}]`);
  logger.info(`WebSocket endpoint available at ws://localhost:${PORT}/ws`);

  // Ensure tables and performance indexes exist (auto-setup for fresh databases)
  try {
    await ensureDatabaseSchema();
  } catch (err) {
    logger.error('[Schema] Failed automatic schema initialization on startup:', err.message);
  }
});

// Graceful shutdown handling
async function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  wss.close(() => {
    logger.info('WebSocket server closed.');
  });
  server.close(async () => {
    logger.info('HTTP server closed.');
    await prisma.$disconnect();
    logger.info('Database connection closed.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forcefully terminating server after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = {
  server,
  app,
};

