const WebSocket = require('ws');
const logger = require('../utils/logger');

// Set of authenticated WebSocket clients
const clients = new Set();

function registerClient(ws, user) {
  ws.user = user;
  clients.add(ws);
  logger.info(`WebSocket client connected. User: ${user.username}. Total clients: ${clients.size}`);
}

function unregisterClient(ws) {
  if (clients.has(ws)) {
    clients.delete(ws);
    const username = ws.user ? ws.user.username : 'unknown';
    logger.info(`WebSocket client disconnected. User: ${username}. Total clients: ${clients.size}`);
  }
}

/**
 * Broadcasts an event to all connected authenticated clients
 * @param {Object} event - e.g. { type: 'changed', revision, entity, material_id, by }
 */
function broadcast(event) {
  const payload = JSON.stringify(event);
  logger.debug(`Broadcasting event: ${payload}`);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (err) {
        logger.error('Failed to send message to client:', { error: err.message });
      }
    }
  }
}

function getConnectedClientCount() {
  return clients.size;
}

module.exports = {
  registerClient,
  unregisterClient,
  broadcast,
  getConnectedClientCount,
};

