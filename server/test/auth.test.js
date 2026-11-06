import { describe, it, expect, beforeEach } from 'vitest';
const request = require('supertest');
const app = require('../src/app');
const { clearDatabase, setupTestAuth, getAdminToken, getStaffToken } = require('./helpers/setup');

describe('Server Auth & Permissions', () => {
  beforeEach(async () => {
    await clearDatabase();
    await setupTestAuth();
  });

  it('allows login with valid credentials and rejects bad password with identical error', async () => {
    const resSuccess = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'password123' });
    expect(resSuccess.status).toBe(200);
    expect(resSuccess.body).toHaveProperty('token');
    expect(resSuccess.body.user.username).toBe('testadmin');

    const resFail = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'wrongpassword' });
    expect(resFail.status).toBe(401);
    expect(resFail.body.error.code).toBe('UNAUTHORIZED');

    const resNonExistent = await request(app)
      .post('/api/auth/login')
      .send({ username: 'noone', password: 'password123' });
    expect(resNonExistent.status).toBe(401);
    expect(resNonExistent.body.error.message).toBe(resFail.body.error.message);
  });

  it('rejects staff from admin endpoints with 403', async () => {
    const staffRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${getStaffToken()}`);
    expect(staffRes.status).toBe(403);
    expect(staffRes.body.error.code).toBe('FORBIDDEN');

    const adminRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${getAdminToken()}`);
    expect(adminRes.status).toBe(200);
    expect(Array.isArray(adminRes.body)).toBe(true);
  });

  it('prevents disabling the last active admin', async () => {
    const usersRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${getAdminToken()}`);
    const admin = usersRes.body.find((u) => u.username === 'testadmin');

    const disableRes = await request(app)
      .patch(`/api/users/${admin.id}`)
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .send({ isActive: false, version: admin.version });

    expect(disableRes.status).toBe(403);
    expect(disableRes.body.error.code).toBe('FORBIDDEN');
  });
});

