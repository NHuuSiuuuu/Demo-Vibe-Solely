const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');

test('GET /api/health returns the service health payload', async () => {
  const response = await request(createApp()).get('/api/health').expect(200);

  assert.deepEqual(response.body, { ok: true, service: 'shoe-store-api' });
});

test('unknown API routes return a JSON not found error', async () => {
  const response = await request(createApp()).get('/api/does-not-exist').expect(404);

  assert.equal(response.headers['content-type'].startsWith('application/json'), true);
  assert.deepEqual(response.body, { message: 'Not found', details: null });
});
