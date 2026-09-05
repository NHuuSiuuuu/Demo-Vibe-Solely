const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const express = require('express');
const request = require('supertest');

const users = [];
let nextUserId = 1;
const originalLoad = Module._load;

process.env.JWT_SECRET = 'test-jwt-secret';

function resetUsers() {
  users.length = 0;
  nextUserId = 1;
}

function toDbUser(user) {
  return {
    id: user.id,
    email: user.email,
    password_hash: user.password_hash,
    role: user.role,
    first_name: user.first_name,
    last_name: user.last_name
  };
}

function findUserByEmail(email) {
  return users.find((user) => user.email === email);
}

function findUserById(id) {
  return users.find((user) => String(user.id) === String(id));
}

async function mockQuery(text, params) {
  if (text.includes('FROM users') && text.includes('WHERE email = $1')) {
    const user = findUserByEmail(params[0]);
    return { rows: user ? [toDbUser(user)] : [], rowCount: user ? 1 : 0 };
  }

  if (text.includes('FROM users') && text.includes('WHERE id = $1')) {
    const user = findUserById(params[0]);
    return { rows: user ? [toDbUser(user)] : [], rowCount: user ? 1 : 0 };
  }

  if (text.includes('INSERT INTO users')) {
    const [email, passwordHash, role, firstName, lastName] = params;
    if (findUserByEmail(email)) {
      const error = new Error('duplicate key value violates unique constraint "users_email_unique"');
      error.code = '23505';
      throw error;
    }

    const user = {
      id: nextUserId++,
      email,
      password_hash: passwordHash,
      role,
      first_name: firstName,
      last_name: lastName
    };
    users.push(user);
    return { rows: [toDbUser(user)], rowCount: 1 };
  }

  throw new Error(`Unexpected SQL in auth test: ${text}`);
}

Module._load = function patchedLoad(requestPath, parent, isMain) {
  if (requestPath === '../db/pool' || requestPath.endsWith('/db/pool')) {
    return { query: mockQuery, pool: { connect: async () => ({ query: mockQuery, release() {} }) } };
  }

  if (requestPath === '../../db/transactions' || requestPath.endsWith('/db/transactions')) {
    return { withTransaction: async (callback) => callback({ query: mockQuery }) };
  }

  return originalLoad.call(this, requestPath, parent, isMain);
};

test.after(() => {
  Module._load = originalLoad;
});

test.beforeEach(() => {
  resetUsers();
});

test('registers a customer and returns a token', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .post('/api/auth/register')
    .send({ name: 'Jordan Miles', email: 'jordan@example.com', password: 'password123' })
    .expect(201);

  assert.equal(typeof response.body.token, 'string');
  assert.deepEqual(response.body.user, {
    id: 1,
    email: 'jordan@example.com',
    name: 'Jordan Miles',
    role: 'customer'
  });
});

test('logs in an existing user and returns profile data', async () => {
  const { createApp } = require('../src/app');
  users.push({
    id: nextUserId++,
    email: 'customer@example.com',
    password_hash: '$2a$10$CwTycUXWue0Thq9StjUM0uDuLhv5HLR6NolzHfzzeGFS7ckdDryDK',
    role: 'customer',
    first_name: 'Sample',
    last_name: 'Customer'
  });

  const response = await request(createApp())
    .post('/api/auth/login')
    .send({ email: 'customer@example.com', password: 'password' })
    .expect(200);

  assert.equal(typeof response.body.token, 'string');
  assert.deepEqual(response.body.user, {
    id: 1,
    email: 'customer@example.com',
    name: 'Sample Customer',
    role: 'customer'
  });
});

test('rejects login with wrong password using 401 JSON', async () => {
  const { createApp } = require('../src/app');
  users.push({
    id: nextUserId++,
    email: 'customer@example.com',
    password_hash: '$2a$10$CwTycUXWue0Thq9StjUM0uDuLhv5HLR6NolzHfzzeGFS7ckdDryDK',
    role: 'customer',
    first_name: 'Sample',
    last_name: 'Customer'
  });

  const response = await request(createApp())
    .post('/api/auth/login')
    .send({ email: 'customer@example.com', password: 'wrong-password' })
    .expect(401);

  assert.equal(response.headers['content-type'].startsWith('application/json'), true);
  assert.deepEqual(response.body, { message: 'Invalid email or password', details: null });
});

test('returns 400 JSON when registration body is empty', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp()).post('/api/auth/register').send().expect(400);

  assert.deepEqual(response.body, { message: 'Name is required', details: null });
});

test('returns current user from bearer token', async () => {
  const { createApp } = require('../src/app');
  const registerResponse = await request(createApp())
    .post('/api/auth/register')
    .send({ name: 'Jordan Miles', email: 'jordan@example.com', password: 'password123' })
    .expect(201);

  const response = await request(createApp())
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${registerResponse.body.token}`)
    .expect(200);

  assert.deepEqual(response.body.user, {
    id: 1,
    email: 'jordan@example.com',
    name: 'Jordan Miles',
    role: 'customer'
  });
});

test('rejects admin middleware for customer token', async () => {
  const { createApp } = require('../src/app');
  const { requireAuth, requireAdmin } = require('../src/middleware/auth');
  const { errorHandler } = require('../src/middleware/errorHandler');
  const app = express();

  app.get('/admin-only', requireAuth, requireAdmin, (req, res) => {
    res.json({ user: req.user });
  });
  app.use(errorHandler);

  const registerResponse = await request(createApp())
    .post('/api/auth/register')
    .send({ name: 'Jordan Miles', email: 'jordan@example.com', password: 'password123' })
    .expect(201);

  const response = await request(app)
    .get('/admin-only')
    .set('Authorization', `Bearer ${registerResponse.body.token}`)
    .expect(403);

  assert.deepEqual(response.body, { message: 'Admin access required', details: null });
});
