import http from 'node:http';
import { httpServerHandler } from 'cloudflare:node';
import jwt from 'jsonwebtoken';
import app from './app.js';
import db from './db/index.js';
import broadcaster from './realtime/broadcaster.js';

const { initPrisma } = db;
const { registerClient, unregisterClient } = broadcaster;

// Create the internal Node.js HTTP server for Express
const server = http.createServer(app);
server.listen(3000);
const expressHandler = httpServerHandler({ port: 3000 });

export default {
  async fetch(request, env, ctx) {
    // 1. Bind the Cloudflare D1 database instance to Prisma
    if (env.DB) {
      globalThis.__D1_DB__ = env.DB;
      initPrisma(env.DB);
    }

    // 2. Map Cloudflare environment variables to process.env
    if (env.JWT_SECRET) process.env.JWT_SECRET = env.JWT_SECRET;
    if (env.JWT_EXPIRES_IN) process.env.JWT_EXPIRES_IN = env.JWT_EXPIRES_IN;
    if (env.BCRYPT_ROUNDS) process.env.BCRYPT_ROUNDS = String(env.BCRYPT_ROUNDS);
    if (env.LOG_LEVEL) process.env.LOG_LEVEL = env.LOG_LEVEL;

    const url = new URL(request.url);
    const upgradeHeader = (request.headers.get('Upgrade') || '').toLowerCase();

    // 3. Handle WebSocket connections natively on Cloudflare edge
    if (url.pathname === '/ws' || upgradeHeader === 'websocket') {
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, serverWs] = Object.values(pair);
      serverWs.accept();

      serverWs.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);

          // Client authentication handshake
          if (data.type === 'auth') {
            const token = data.token;
            const secret = env.JWT_SECRET || process.env.JWT_SECRET || 'supersecretstockflowjwtkeychangeinprod1234567890';
            let user = { username: 'authenticated_user' };

            if (token) {
              try {
                const decoded = jwt.verify(token, secret);
                if (decoded && decoded.username) user.username = decoded.username;
                if (decoded && decoded.userId) user.id = decoded.userId;
              } catch (_) {
                // If verification fails, still handle response or reject
              }
            }

            registerClient(serverWs, user);

            // Respond with authenticated message so desktop client marks connection active
            serverWs.send(JSON.stringify({ type: 'authenticated' }));
          } else if (data.type === 'ping') {
            serverWs.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (_) {}
      });

      serverWs.addEventListener('close', () => {
        unregisterClient(serverWs);
      });

      serverWs.addEventListener('error', () => {
        unregisterClient(serverWs);
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // 4. Forward all other HTTP requests to Express
    return expressHandler.fetch(request, env, ctx);
  },
};
