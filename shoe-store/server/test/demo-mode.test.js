const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');

function clearAppModules() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes('/server/src/')) {
      delete require.cache[key];
    }
  }
}

test('serves catalog and registers customers when DATABASE_URL is missing', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  clearAppModules();

  try {
    const { createApp } = require('../src/app');
    const app = createApp();

    const catalogResponse = await request(app)
      .get('/api/products')
      .expect(200);

    assert.ok(catalogResponse.body.products.length >= 8);

    const email = `demo-${Date.now()}@example.com`;
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Demo Customer', email, password: 'Password123!' })
      .expect(201);

    assert.equal(registerResponse.body.user.email, email);
    assert.equal(registerResponse.body.user.role, 'customer');
    assert.equal(typeof registerResponse.body.token, 'string');
  } finally {
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    clearAppModules();
  }
});
