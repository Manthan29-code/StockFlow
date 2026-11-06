const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../config');
const usersRepo = require('../repositories/users.repo');
const { registerClient, unregisterClient } = require('./broadcaster');
const logger = require('../utils/logger');

function initWebSocketServer(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.isAuthenticated = false;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // 5-second auth timeout
    const authTimeout = setTimeout(() => {
      if (!ws.isAuthenticated) {
        logger.warn('WebSocket client failed to authenticate within 5 seconds. Closing connection.');
        ws.close(4001, 'Authentication timeout');
      }
    }, 5000);

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'auth') {
          const { token } = data;
          if (!token) {
            clearTimeout(authTimeout);
            ws.close(4002, 'Token required');
            return;
          }

          let payload;
          try {
            payload = jwt.verify(token, config.JWT_SECRET);
          } catch (err) {
            clearTimeout(authTimeout);
            ws.close(4003, 'Invalid token');
            return;
          }

          const user = await usersRepo.findById(payload.userId);
          if (!user || !user.isActive) {
            clearTimeout(authTimeout);
            ws.close(4004, 'User inactive or not found');
            return;
          }

          clearTimeout(authTimeout);
          ws.isAuthenticated = true;
          registerClient(ws, user);

          ws.send(JSON.stringify({ type: 'authenticated', user: { id: user.id, username: user.username } }));
        }
      } catch (err) {
        logger.error('Error handling WebSocket message:', { error: err.message });
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      unregisterClient(ws);
    });

    ws.on('error', (err) => {
      logger.error('WebSocket connection error:', { error: err.message });
      clearTimeout(authTimeout);
      unregisterClient(ws);
    });
  });

  // Periodic ping interval to keepalive and drop dead clients
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        unregisterClient(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, config.WS_PING_INTERVAL_MS || 30000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  return wss;
}

module.exports = {
  initWebSocketServer,
};

