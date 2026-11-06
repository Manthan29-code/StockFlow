import { describe, it, expect, beforeEach } from 'vitest';
const request = require('supertest');
const app = require('../src/app');
const { clearDatabase, setupTestAuth, getAdminToken, prisma } = require('./helpers/setup');

describe('Concurrency & Row-Level Locking', () => {
  beforeEach(async () => {
    await clearDatabase();
    await setupTestAuth();
  });

  it('allows exactly one of two concurrent requests of 300 against balance 500', async () => {
    const nosUnit = await prisma.unit.findUnique({ where: { code: 'nos' } });

    const matRes = await request(app)
      .post('/api/materials')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        name: 'Concurrent Test Bearing',
        unitId: nosUnit.id,
        deductBy: 'direct',
      });
    const materialId = matRes.body.id;

    // Incoming: 500
    const inRes = await request(app)
      .post('/api/incoming')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        materialId,
        inDate: '2026-03-01',
        challanNo: 'IN-500',
        quantity: '500',
      });
    const entryId = inRes.body.id;

    // Fire two parallel outgoing requests of 300 each simultaneously
    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/outgoing')
        .set('Authorization', `Bearer ${getAdminToken()}`)
        .send({
          incomingEntryId: entryId,
          outDate: '2026-03-02',
          challanNo: 'OUT-A',
          qty: '300',
        }),
      request(app)
        .post('/api/outgoing')
        .set('Authorization', `Bearer ${getAdminToken()}`)
        .send({
          incomingEntryId: entryId,
          outDate: '2026-03-02',
          challanNo: 'OUT-B',
          qty: '300',
        }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    // One must succeed (201) and the other must fail with 422 (INSUFFICIENT_BALANCE)
    expect(statuses).toEqual([201, 422]);

    const failed = resA.status === 422 ? resA : resB;
    expect(failed.body.error.code).toBe('INSUFFICIENT_BALANCE');
  });
});

