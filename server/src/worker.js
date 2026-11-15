const http = require('node:http');
const { httpServerHandler } = require('cloudflare:node');
const app = require('./app');
const { initPrisma } = require('./db');

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

    // 3. Handle WebSocket connections natively on the edge
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, serverWs] = Object.values(pair);
      serverWs.accept();

      serverWs.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ping') {
            serverWs.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (_) {}
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // 4. Forward all HTTP requests to Express
    return expressHandler.fetch(request, env, ctx);
  },
};

