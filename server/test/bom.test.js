import { describe, it, expect, beforeEach } from 'vitest';
const request = require('supertest');
const app = require('../src/app');
const { clearDatabase, setupTestAuth, getAdminToken, prisma } = require('./helpers/setup');

describe('BOM & Production Requirement Calculation', () => {
  beforeEach(async () => {
    await clearDatabase();
    await setupTestAuth();
  });

  it('calculates production requirement vs stock correctly', async () => {
    const kg = await prisma.unit.findUnique({ where: { code: 'kg' } });
    const nos = await prisma.unit.findUnique({ where: { code: 'nos' } });

    // Party: Harsh
    const partyRes = await request(app)
      .post('/api/parties')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({ name: 'Harsh' });
    const partyId = partyRes.body.id;

    // Product: 0.5 HP ultra rotor SL60 TL271
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({ partyId, name: '0.5 HP ultra rotor SL60 TL271' });
    const productId = prodRes.body.id;

    // Material A (Round bar)
    const matARes = await request(app)
      .post('/api/materials')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        name: 'Dia 20mm round bar',
        unitId: kg.id,
        deductBy: 'qty_x_piece_weight',
        specLabel: 'TL',
      });
    const matAId = matARes.body.id;

    // Material B (Rotor die cast)
    const matBRes = await request(app)
      .post('/api/materials')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        name: 'Rotor die cast 58x60',
        unitId: nos.id,
        deductBy: 'direct',
      });
    const matBId = matBRes.body.id;

    // BOM Line 1: mat A, consumption 0.700, spec 271
    await request(app)
      .post(`/api/products/${productId}/bom-lines`)
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        materialId: matAId,
        consumption: '0.700',
        specValue: '271',
      });

    // BOM Line 2: mat B, consumption 1
    await request(app)
      .post(`/api/products/${productId}/bom-lines`)
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        materialId: matBId,
        consumption: '1',
      });

    // Add stock: 50 kg of Mat A, 150 nos of Mat B
    await request(app)
      .post('/api/incoming')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({ materialId: matAId, inDate: '2026-04-01', challanNo: 'IN-A', quantity: '50' });

    await request(app)
      .post('/api/incoming')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({ materialId: matBId, inDate: '2026-04-01', challanNo: 'IN-B', quantity: '150' });

    // Request requirement for 100 finished units
    const reqRes = await request(app)
      .get(`/api/products/${productId}/requirement?qty=100`)
      .set('Authorization', `Bearer ${getAdminToken()}`);

    expect(reqRes.status).toBe(200);
    const reqs = reqRes.body.requirements;

    // Mat A needs 70 kg, stock is 50 kg -> shortfall 20 kg
    const reqA = reqs.find((r) => r.materialId === matAId);
    expect(reqA.required).toBe('70');
    expect(reqA.availableStock).toBe('50');
    expect(reqA.shortfall).toBe('20');
    expect(reqA.isShort).toBe(true);

    // Mat B needs 100 nos, stock is 150 nos -> shortfall 0
    const reqB = reqs.find((r) => r.materialId === matBId);
    expect(reqB.required).toBe('100');
    expect(reqB.availableStock).toBe('150');
    expect(reqB.shortfall).toBe('0');
    expect(reqB.isShort).toBe(false);
  });
});

