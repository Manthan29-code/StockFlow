import { describe, it, expect, beforeEach, afterEach } from 'vitest';
const http = require('http');
const WebSocket = require('ws');
const request = require('supertest');
const app = require('../src/app');
const { initWebSocketServer } = require('../src/realtime/wsServer');
const { clearDatabase, setupTestAuth, getAdminToken, getStaffToken, prisma } = require('./helpers/setup');

describe('Realtime WebSocket Sync', () => {
  let server;
  let port;

  beforeEach(async () => {
    await clearDatabase();
    await setupTestAuth();

    server = http.createServer(app);
    initWebSocketServer(server);
    await new Promise((resolve) => server.listen(0, resolve));
    port = server.address().port;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('authenticates client and broadcasts changed event on database write', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    await new Promise((resolve) => ws.on('open', resolve));

    // Send auth message
    ws.send(JSON.stringify({ type: 'auth', token: getStaffToken() }));

    const authReply = await new Promise((resolve) => {
      ws.once('message', (msg) => resolve(JSON.parse(msg.toString())));
    });
    expect(authReply.type).toBe('authenticated');

    // Setup listener for broadcast
    const broadcastPromise = new Promise((resolve) => {
      ws.on('message', (msg) => {
        const data = JSON.parse(msg.toString());
        if (data.type === 'changed') {
          resolve(data);
        }
      });
    });

    // Make an admin write (create party)
    await request(app)
      .post('/api/parties')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({ name: 'Broadcast Test Party' });

    const event = await broadcastPromise;
    expect(event.type).toBe('changed');
    expect(event.entity).toBe('parties');
    expect(event).toHaveProperty('revision');

    ws.close();
  });
});

