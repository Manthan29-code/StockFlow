import { describe, it, expect, beforeEach } from 'vitest';
const request = require('supertest');
const app = require('../src/app');
const { clearDatabase, setupTestAuth, getAdminToken, prisma } = require('./helpers/setup');

describe('Backup & Restore (Section 3.2)', () => {
  beforeEach(async () => {
    await clearDatabase();
    await setupTestAuth();
  });

  it('backs up dataset, restores into empty database and preserves exact records', async () => {
    const kg = await prisma.unit.findUnique({ where: { code: 'kg' } });

    // Create a material
    const matRes = await request(app)
      .post('/api/materials')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        name: 'Backup Test Brass',
        unitId: kg.id,
        deductBy: 'direct',
      });
    const materialId = matRes.body.id;

    // Add entry
    await request(app)
      .post('/api/incoming')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({
        materialId,
        inDate: '2026-05-01',
        challanNo: 'IN-BCK-1',
        quantity: '300',
      });

    // 1. Take backup
    const backupRes = await request(app)
      .get('/api/admin/backup')
      .set('Authorization', `Bearer ${getAdminToken()}`);

    expect(backupRes.status).toBe(200);
    const backupPayload = backupRes.body;
    expect(backupPayload.formatVersion).toBe(1);
    expect(backupPayload.data.materials.length).toBeGreaterThan(0);

    // 2. Clear database
    await clearDatabase();
    await setupTestAuth();

    // 3. Restore backup
    const restoreRes = await request(app)
      .post('/api/admin/restore')
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send(backupPayload);

    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.success).toBe(true);

    // 4. Verify material exists
    const checkMat = await request(app)
      .get(`/api/materials/${materialId}`)
      .set('Authorization', `Bearer ${getAdminToken()}`);

    expect(checkMat.status).toBe(200);
    expect(checkMat.body.name).toBe('Backup Test Brass');
  });
});

