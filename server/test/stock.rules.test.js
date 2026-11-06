import { describe, it, expect, beforeEach } from 'vitest';
const request = require('supertest');
const app = require('../src/app');
const { clearDatabase, setupTestAuth, getAdminToken, prisma } = require('./helpers/setup');

describe('Stock Write Rules (Section 6)', () => {
  let materialId;
  let entryId;

  beforeEach(async () => {
    await clearDatabase();
    await setupTestAuth();

    const nosUnit = await prisma.unit.findUnique({ where: { code: 'nos' } });
    const matRes = await request(app)
      .post('/api/materials')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        name: 'Standard Gear',
        unitId: nosUnit.id,
        deductBy: 'direct',
      });
    materialId = matRes.body.id;

    const inRes = await request(app)
      .post('/api/incoming')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        materialId,
        inDate: '2026-02-01',
        challanNo: 'IN-001',
        quantity: '100',
      });
    entryId = inRes.body.id;
  });

  it('rejects outgoing row that exceeds available balance', async () => {
    const res = await request(app)
      .post('/api/outgoing')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        incomingEntryId: entryId,
        outDate: '2026-02-02',
        challanNo: 'OUT-OVER',
        qty: '101',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');
  });

  it('rejects outgoing date earlier than incoming date', async () => {
    const res = await request(app)
      .post('/api/outgoing')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        incomingEntryId: entryId,
        outDate: '2026-01-31', // earlier than 2026-02-01
        challanNo: 'OUT-EARLY',
        qty: '10',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects deleting an incoming entry that has outgoing transactions', async () => {
    // Add valid outgoing row
    await request(app)
      .post('/api/outgoing')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        incomingEntryId: entryId,
        outDate: '2026-02-02',
        challanNo: 'OUT-1',
        qty: '30',
      });

    const delRes = await request(app)
      .delete(`/api/incoming/${entryId}`)
      .set('Authorization', `Bearer ${getAdminToken()}`);

    expect(delRes.status).toBe(422);
    expect(delRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects reducing incoming quantity below already deducted amount', async () => {
    await request(app)
      .post('/api/outgoing')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        incomingEntryId: entryId,
        outDate: '2026-02-02',
        challanNo: 'OUT-1',
        qty: '40',
      });

    const inEntry = await prisma.incomingEntry.findUnique({ where: { id: entryId } });

    // Try to update incoming quantity to 35 (less than 40)
    const patchRes = await request(app)
      .patch(`/api/incoming/${entryId}`)
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        quantity: '35',
        version: inEntry.version,
      });

    expect(patchRes.status).toBe(422);
    expect(patchRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects editing an old row if it makes a later balance negative', async () => {
    // Row 1: issue 50 (leaves 50)
    const r1 = await request(app)
      .post('/api/outgoing')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        incomingEntryId: entryId,
        outDate: '2026-02-02',
        challanNo: 'OUT-1',
        qty: '50',
      });

    // Row 2: issue 40 (leaves 10)
    await request(app)
      .post('/api/outgoing')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        incomingEntryId: entryId,
        outDate: '2026-02-03',
        challanNo: 'OUT-2',
        qty: '40',
      });

    const row1 = r1.body;

    // Now try to edit row 1 from 50 to 70.
    // That would mean: 100 - 70 = 30, then 30 - 40 = -10 (negative balance!).
    const editRes = await request(app)
      .patch(`/api/outgoing/${row1.id}`)
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        qty: '70',
        version: row1.version,
      });

    expect(editRes.status).toBe(422);
    expect(editRes.body.error.code).toBe('INSUFFICIENT_BALANCE');
  });
});

