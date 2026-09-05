const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const originalLoad = Module._load;

process.env.JWT_SECRET = 'test-jwt-secret';

const users = [
  {
    id: 1,
    email: 'customer@example.com',
    password_hash: 'hash',
    role: 'customer',
    first_name: 'Sample',
    last_name: 'Customer'
  },
  {
    id: 2,
    email: 'admin@example.com',
    password_hash: 'hash',
    role: 'admin',
    first_name: 'Admin',
    last_name: 'User'
  }
];

const matchingProductRows = [
  {
    id: '10',
    name: 'Nike Air Zoom Pegasus',
    slug: 'nike-air-zoom-pegasus',
    brand: 'Nike',
    category: 'running',
    gender: 'men',
    price: '950000.00',
    imageUrl: '/images/nike-air-zoom-pegasus.jpg',
    availableSizes: ['41', '42'],
    availableColors: ['black', 'white'],
    totalStock: '7'
  },
  {
    id: '11',
    name: 'Nike Downshifter',
    slug: 'nike-downshifter',
    brand: 'Nike',
    category: 'running',
    gender: 'men',
    price: '890000.00',
    imageUrl: '/images/nike-downshifter.jpg',
    availableSizes: ['42', '43'],
    availableColors: ['blue'],
    totalStock: '4'
  }
];

let storedMessages;
let lastProductQuery;

function resetStore() {
  storedMessages = [];
  lastProductQuery = null;
}

function tokenFor(userId) {
  const user = users.find((candidate) => candidate.id === userId);
  return jwt.sign({ sub: String(user.id), role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function normalizeCard(row) {
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    category: row.category,
    gender: row.gender,
    price: Number(row.price),
    imageUrl: row.imageUrl,
    availableSizes: row.availableSizes,
    availableColors: row.availableColors,
    totalStock: Number(row.totalStock)
  };
}

async function mockQuery(text, params = []) {
  if (text.includes('FROM users') && text.includes('WHERE id = $1')) {
    const user = users.find((candidate) => String(candidate.id) === String(params[0]));
    return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
  }

  if (text.includes('FROM products p') && text.includes("p.status = 'active'")) {
    lastProductQuery = { text, params };

    if (params.includes('42') && params.includes('1000000') && params.includes('men')) {
      return { rows: matchingProductRows, rowCount: matchingProductRows.length };
    }

    return { rows: [], rowCount: 0 };
  }

  if (text.includes('INSERT INTO ai_chat_messages')) {
    const [userId, sessionId, role, content] = params;
    storedMessages.push({ userId: Number(userId), sessionId, role, content });
    return { rows: [], rowCount: 1 };
  }

  throw new Error(`Unexpected SQL in ai test: ${text}`);
}

Module._load = function patchedLoad(requestPath, parent, isMain) {
  if (requestPath === '../../db/pool' || requestPath === '../db/pool' || requestPath.endsWith('/db/pool')) {
    return { query: mockQuery, pool: { connect: async () => ({ query: mockQuery, release() {} }) } };
  }

  return originalLoad.call(this, requestPath, parent, isMain);
};

test.after(() => {
  Module._load = originalLoad;
});

test.beforeEach(() => {
  resetStore();
});

test('requires auth to use ai chat', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp()).post('/api/ai/chat').send({ message: 'Tư vấn giày chạy bộ' }).expect(401);

  assert.deepEqual(response.body, { message: 'Authentication required', details: null });
});

test('returns catalog recommendations for budget and size', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .post('/api/ai/chat')
    .set('Authorization', `Bearer ${tokenFor(1)}`)
    .send({ message: 'Tôi cần giày nam size 42 dưới 1 triệu để chạy bộ Nike' })
    .expect(200);

  assert.equal(response.body.products.length, 2);
  assert.deepEqual(response.body.products, matchingProductRows.map(normalizeCard));
  assert.match(response.body.answer, /Gợi ý/i);
  assert.match(response.body.answer, /Nike Air Zoom Pegasus/);
  assert.match(lastProductQuery.text, /p\.base_price <=/);
  assert.match(lastProductQuery.text, /filtered_variant\.size =/);
});

test('returns a helpful fallback when no product matches', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .post('/api/ai/chat')
    .set('Authorization', `Bearer ${tokenFor(1)}`)
    .send({ message: 'Tôi cần giày nữ size 35 dưới 100 nghìn' })
    .expect(200);

  assert.deepEqual(response.body.products, []);
  assert.match(response.body.answer, /không có sản phẩm phù hợp chính xác/i);
  assert.match(response.body.answer, /mở rộng bộ lọc/i);
});

test('stores user and assistant messages', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .post('/api/ai/chat')
    .set('Authorization', `Bearer ${tokenFor(1)}`)
    .send({ message: 'Tôi cần giày nam size 42 dưới 1 triệu' })
    .expect(200);

  assert.equal(storedMessages.length, 2);
  assert.deepEqual(storedMessages.map((message) => message.role), ['user', 'assistant']);
  assert.equal(storedMessages[0].userId, 1);
  assert.equal(storedMessages[0].content, 'Tôi cần giày nam size 42 dưới 1 triệu');
  assert.equal(storedMessages[1].content, response.body.answer);
});
