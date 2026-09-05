const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');

test('GET /api/health returns the service health payload', async () => {
  const response = await request(createApp()).get('/api/health').expect(200);

  assert.deepEqual(response.body, { ok: true, service: 'shoe-store-api' });
});
