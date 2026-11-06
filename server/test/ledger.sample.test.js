import { describe, it, expect, beforeEach } from 'vitest';
const request = require('supertest');
const app = require('../src/app');
const { clearDatabase, setupTestAuth, getAdminToken, prisma } = require('./helpers/setup');

describe('Acceptance Data Ledgers (Section 11)', () => {
  beforeEach(async () => {
    await clearDatabase();
    await setupTestAuth();
  });

  it('calculates exact running balances for Example Material A (Round bar 20mm)', async () => {
    const kgUnit = await prisma.unit.findUnique({ where: { code: 'kg' } });

    const matRes = await request(app)
      .post('/api/materials')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        name: '20 mm round bar',
        unitId: kgUnit.id,
        deductBy: 'qty_x_piece_weight',
        specLabel: 'TL',
      });
    const materialId = matRes.body.id;

    // Incoming: 25-11-2024, 24/1596, 650 kg
    const inRes = await request(app)
      .post('/api/incoming')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        materialId,
        inDate: '2024-11-25',
        challanNo: '24/1596',
        quantity: '650',
      });
    const entryId = inRes.body.id;

    const sampleRows = [
      { outDate: '2024-11-25', challanNo: '690', specValue: '271', qty: '85', pieceWeight: '0.7' },
      { outDate: '2024-11-27', challanNo: '695', specValue: '271', qty: '100', pieceWeight: '0.7' },
      { outDate: '2024-11-28', challanNo: '698', specValue: '271', qty: '115', pieceWeight: '0.7' },
      { outDate: '2024-11-28', challanNo: '698', specValue: '225.5', qty: '235', pieceWeight: '0.59' },
      { outDate: '2024-11-29', challanNo: '703', specValue: '271', qty: '104', pieceWeight: '0.7' },
      { outDate: '2024-12-04', challanNo: '714', specValue: '271', qty: '124', pieceWeight: '0.7' },
      { outDate: '2024-12-09', challanNo: '727', specValue: '225.5', qty: '240', pieceWeight: '0.59' },
    ];

    for (const r of sampleRows) {
      await request(app)
        .post('/api/outgoing')
        .set('Authorization', `Bearer ${getAdminToken()}`)
        .send({
          incomingEntryId: entryId,
          ...r,
        });
    }

    const ledgerRes = await request(app)
      .get(`/api/materials/${materialId}/ledger`)
      .set('Authorization', `Bearer ${getAdminToken()}`);

    expect(ledgerRes.status).toBe(200);
    const entry = ledgerRes.body.entries[0];
    const runningBalances = entry.outgoingRows.map((r) => r.runningBalance);

    expect(runningBalances).toEqual([
      '590.5',
      '520.5',
      '440',
      '301.35',
      '228.55',
      '141.75',
      '0.15',
    ]);
    expect(entry.balance).toBe('0.15');
    expect(ledgerRes.body.totalStock).toBe('0.15');
  });

  it('calculates exact running balances for Example Material B (Rotor die cast 58x60 ULTRA)', async () => {
    const nosUnit = await prisma.unit.findUnique({ where: { code: 'nos' } });

    const matRes = await request(app)
      .post('/api/materials')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        name: 'Rotor die cast 58 x 60 ULTRA',
        unitId: nosUnit.id,
        deductBy: 'direct',
      });
    const materialId = matRes.body.id;

    // Entry 1: 500
    const in1 = await request(app).post('/api/incoming').set('Authorization', `Bearer ${getAdminToken()}`).send({
      materialId,
      inDate: '2024-11-14',
      challanNo: '24/1509',
      quantity: '500',
    });
    await request(app).post('/api/outgoing').set('Authorization', `Bearer ${getAdminToken()}`).send({
      incomingEntryId: in1.body.id,
      outDate: '2024-11-28',
      challanNo: '698',
      qty: '235',
    });
    await request(app).post('/api/outgoing').set('Authorization', `Bearer ${getAdminToken()}`).send({
      incomingEntryId: in1.body.id,
      outDate: '2024-12-09',
      challanNo: '727',
      qty: '264',
    });
    await request(app).post('/api/outgoing').set('Authorization', `Bearer ${getAdminToken()}`).send({
      incomingEntryId: in1.body.id,
      outDate: '2024-12-16',
      challanNo: '747',
      qty: '1',
    });

    // Entry 2: 620
    const in2 = await request(app).post('/api/incoming').set('Authorization', `Bearer ${getAdminToken()}`).send({
      materialId,
      inDate: '2024-12-12',
      challanNo: '24/1716',
      quantity: '620',
    });
    await request(app).post('/api/outgoing').set('Authorization', `Bearer ${getAdminToken()}`).send({
      incomingEntryId: in2.body.id,
      outDate: '2024-12-16',
      challanNo: '747',
      qty: '315',
    });
    await request(app).post('/api/outgoing').set('Authorization', `Bearer ${getAdminToken()}`).send({
      incomingEntryId: in2.body.id,
      outDate: '2024-12-18',
      challanNo: '751',
      qty: '55',
    });
    await request(app).post('/api/outgoing').set('Authorization', `Bearer ${getAdminToken()}`).send({
      incomingEntryId: in2.body.id,
      outDate: '2024-12-27',
      challanNo: '776',
      qty: '250',
    });

    // Entry 3: 541
    const in3 = await request(app).post('/api/incoming').set('Authorization', `Bearer ${getAdminToken()}`).send({
      materialId,
      inDate: '2025-01-02',
      challanNo: '24/1917',
      quantity: '541',
    });
    await request(app).post('/api/outgoing').set('Authorization', `Bearer ${getAdminToken()}`).send({
      incomingEntryId: in3.body.id,
      outDate: '2025-01-02',
      challanNo: '788',
      qty: '20',
    });
    await request(app).post('/api/outgoing').set('Authorization', `Bearer ${getAdminToken()}`).send({
      incomingEntryId: in3.body.id,
      outDate: '2025-01-04',
      challanNo: '793',
      qty: '180',
    });
    await request(app).post('/api/outgoing').set('Authorization', `Bearer ${getAdminToken()}`).send({
      incomingEntryId: in3.body.id,
      outDate: '2025-01-10',
      challanNo: '810',
      qty: '341',
    });

    const ledgerRes = await request(app)
      .get(`/api/materials/${materialId}/ledger`)
      .set('Authorization', `Bearer ${getAdminToken()}`);

    const [e1, e2, e3] = ledgerRes.body.entries;
    expect(e1.outgoingRows.map((r) => r.runningBalance)).toEqual(['265', '1', '0']);
    expect(e2.outgoingRows.map((r) => r.runningBalance)).toEqual(['305', '250', '0']);
    expect(e3.outgoingRows.map((r) => r.runningBalance)).toEqual(['521', '341', '0']);

    expect(e1.balance).toBe('0');
    expect(e2.balance).toBe('0');
    expect(e3.balance).toBe('0');
    expect(ledgerRes.body.totalStock).toBe('0');
  });
});

