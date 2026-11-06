import { describe, it, expect, beforeEach } from 'vitest';
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const { clearDatabase, setupTestAuth, getAdminToken, prisma } = require('./helpers/setup');

describe('Materials & Units', () => {
  beforeEach(async () => {
    await clearDatabase();
    await setupTestAuth();
  });

  it('ensures no $queryRaw or $executeRaw exists anywhere in server/src', () => {
    const srcDir = path.resolve(__dirname, '../src');
    function checkDir(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          checkDir(fullPath);
        } else if (file.endsWith('.js')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          expect(content.includes('$queryRaw')).toBe(false);
          expect(content.includes('$executeRaw')).toBe(false);
        }
      }
    }
    checkDir(srcDir);
  });

  it('prevents changing deduct_by after outgoing rows exist', async () => {
    const unit = await prisma.unit.findUnique({ where: { code: 'kg' } });

    // 1. Create material
    const matRes = await request(app)
      .post('/api/materials')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        name: 'Steel Rod 16mm',
        unitId: unit.id,
        deductBy: 'qty_x_piece_weight',
        specLabel: 'Length',
      });
    expect(matRes.status).toBe(201);
    const materialId = matRes.body.id;

    // 2. Create incoming entry
    const inRes = await request(app)
      .post('/api/incoming')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        materialId,
        inDate: '2026-01-10',
        challanNo: 'CH-100',
        quantity: '500',
      });
    expect(inRes.status).toBe(201);
    const entryId = inRes.body.id;

    // 3. Create outgoing row
    const outRes = await request(app)
      .post('/api/outgoing')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        incomingEntryId: entryId,
        outDate: '2026-01-11',
        challanNo: 'OUT-1',
        qty: '10',
        pieceWeight: '2.5',
      });
    expect(outRes.status).toBe(201);

    // 4. Attempt to change deduct_by -> should fail
    const patchRes = await request(app)
      .patch(`/api/materials/${materialId}`)
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        deductBy: 'direct',
        version: matRes.body.version,
      });

    expect(patchRes.status).toBe(422);
    expect(patchRes.body.error.code).toBe('VALIDATION_ERROR');
  });
});

