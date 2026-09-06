const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const originalLoad = Module._load;
const originalFetch = global.fetch;
const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalOpenAiModel = process.env.OPENAI_MODEL;
const originalGeminiApiKey = process.env.GEMINI_API_KEY;

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

const productRows = [
  {
    id: '12',
    name: 'Solely Trail Guard',
    slug: 'trail-guard-pro',
    brand: 'Solely',
    category: 'trail',
    gender: 'men',
    price: '2490000.00',
    imageUrl: '/images/solely-trail-guard.jpg',
    availableSizes: ['42', '43'],
    availableColors: ['olive'],
    totalStock: '5'
  }
];

const additionalProductRows = [
  {
    id: '13',
    name: 'Solely City Walk',
    slug: 'city-walk',
    brand: 'Solely',
    category: 'walking',
    gender: 'unisex',
    price: '1690000.00',
    imageUrl: '/images/solely-city-walk.jpg',
    availableSizes: ['40', '41'],
    availableColors: ['black'],
    totalStock: '4'
  },
  {
    id: '14',
    name: 'Solely Daily Court',
    slug: 'daily-court',
    brand: 'Solely',
    category: 'sneakers',
    gender: 'unisex',
    price: '1490000.00',
    imageUrl: '/images/solely-daily-court.jpg',
    availableSizes: ['41', '42'],
    availableColors: ['white'],
    totalStock: '7'
  }
];

const policyRetrievalRows = [
  {
    id: '101',
    source_type: 'document',
    source_id: '4',
    title: 'Đổi trả',
    content:
      'Khách có thể yêu cầu đổi trả khi sản phẩm còn nguyên tình trạng, chưa sử dụng ngoài phạm vi thử size trong nhà và còn đầy đủ hộp, tem, phụ kiện đi kèm.',
    metadata: { documentType: 'returns', slug: 'doi-tra' },
    score: '0.91'
  }
];

const productRetrievalRows = [
  {
    id: '201',
    source_type: 'product',
    source_id: '12',
    title: 'Solely Trail Guard',
    content: 'Giày trail nam cho trekking cuối tuần, đi rừng nhẹ và đường mòn khô.',
    metadata: { productId: 12, slug: 'trail-guard-pro', category: 'trail', gender: 'men' },
    score: '0.94'
  }
];

const threeProductRetrievalRows = [
  ...productRetrievalRows,
  {
    id: '202',
    source_type: 'product',
    source_id: '13',
    title: 'Solely City Walk',
    content: 'Giày đi bộ êm cho lịch trình hằng ngày.',
    metadata: { productId: 13, slug: 'city-walk', category: 'walking', gender: 'unisex' },
    score: '0.91'
  },
  {
    id: '203',
    source_type: 'product',
    source_id: '14',
    title: 'Solely Daily Court',
    content: 'Sneaker đi chơi nhẹ, dễ phối đồ.',
    metadata: { productId: 14, slug: 'daily-court', category: 'sneakers', gender: 'unisex' },
    score: '0.88'
  }
];

let storedMessages;
let retrievalRows;

function resetStore() {
  storedMessages = [];
  retrievalRows = policyRetrievalRows;
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

  if (text.includes('FROM rag_chunks') && text.includes('embedding <=>')) {
    return { rows: retrievalRows, rowCount: retrievalRows.length };
  }

  if (text.includes('FROM products p') && text.includes('p.id = ANY($1::bigint[])')) {
    const ids = new Set((params[0] || []).map((id) => String(id)));
    const rows = [...productRows, ...additionalProductRows].filter((product) => ids.has(String(product.id)));
    return { rows, rowCount: rows.length };
  }

  if (text.includes('INSERT INTO ai_chat_messages')) {
    const [userId, sessionId, role, content] = params;
    storedMessages.push({ userId: Number(userId), sessionId, role, content });
    return { rows: [], rowCount: 1 };
  }

  throw new Error(`Unexpected SQL in ai test: ${text}`);
}

async function mockGeminiFetch(url, options = {}) {
  if (String(url).includes(':embedContent')) {
    return {
      ok: true,
      async json() {
        return { embedding: { values: Array.from({ length: 768 }, () => 0.1) } };
      }
    };
  }

  if (String(url).includes(':generateContent')) {
    const body = JSON.parse(options.body || '{}');
    const prompt = body.contents?.[0]?.parts?.[0]?.text || '';
    const text = prompt.includes('Đổi trả')
      ? 'Solely hỗ trợ đổi trả khi sản phẩm còn nguyên tình trạng, chưa sử dụng ngoài phạm vi thử size trong nhà và còn đủ hộp, tem, phụ kiện.'
      : 'Mình gợi ý Solely Trail Guard cho nhu cầu trekking vì mẫu này có độ bám cao và mũi giày gia cố.';

    return {
      ok: true,
      async json() {
        return { candidates: [{ content: { parts: [{ text }] } }] };
      }
    };
  }

  throw new Error(`Unexpected fetch in ai test: ${url}`);
}

Module._load = function patchedLoad(requestPath, parent, isMain) {
  if (requestPath === '../../db/pool' || requestPath === '../db/pool' || requestPath.endsWith('/db/pool')) {
    return { query: mockQuery, pool: { connect: async () => ({ query: mockQuery, release() {} }) } };
  }

  return originalLoad.call(this, requestPath, parent, isMain);
};

test.after(() => {
  Module._load = originalLoad;
  global.fetch = originalFetch;
  if (originalOpenAiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }
  if (originalOpenAiModel === undefined) {
    delete process.env.OPENAI_MODEL;
  } else {
    process.env.OPENAI_MODEL = originalOpenAiModel;
  }
  if (originalGeminiApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalGeminiApiKey;
  }
});

test.beforeEach(() => {
  resetStore();
  global.fetch = mockGeminiFetch;
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
});

test('requires auth to use ai chat', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp()).post('/api/ai/chat').send({ message: 'Tư vấn giày chạy bộ' }).expect(401);

  assert.deepEqual(response.body, { message: 'Authentication required', details: null });
});

test('returns RAG product cards and sources for product advice', async () => {
  const { createApp } = require('../src/app');
  retrievalRows = productRetrievalRows;

  const response = await request(createApp())
    .post('/api/ai/chat')
    .set('Authorization', `Bearer ${tokenFor(1)}`)
    .send({ message: 'Tôi cần giày đi leo núi hoặc trekking cuối tuần' })
    .expect(200);

  assert.deepEqual(response.body.products, productRows.map(normalizeCard));
  assert.match(response.body.answer, /Solely Trail Guard/);
  assert.deepEqual(response.body.sources, [
    {
      type: 'product',
      id: 12,
      title: 'Solely Trail Guard',
      score: 0.94,
      productId: 12,
      slug: 'trail-guard-pro'
    }
  ]);
});

test('limits RAG product cards when Vietnamese message requests two products', async () => {
  const { createApp } = require('../src/app');
  retrievalRows = threeProductRetrievalRows;

  const response = await request(createApp())
    .post('/api/ai/chat')
    .set('Authorization', `Bearer ${tokenFor(1)}`)
    .send({ message: '2 sản phẩm' })
    .expect(200);

  assert.equal(response.body.products.length, 2);
  assert.deepEqual(
    response.body.products.map((product) => product.id),
    [12, 13]
  );
});

test('does not persist casual AI chat messages', async () => {
  const { createApp } = require('../src/app');

  await request(createApp())
    .post('/api/ai/chat')
    .set('Authorization', `Bearer ${tokenFor(1)}`)
    .send({ message: 'alo' })
    .expect(200);

  assert.equal(storedMessages.length, 0);
});

test('returns no product cards for policy-only RAG answer', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .post('/api/ai/chat')
    .set('Authorization', `Bearer ${tokenFor(1)}`)
    .send({ message: 'Shop đổi trả như thế nào?' })
    .expect(200);

  assert.equal(response.body.products.length, 0);
  assert.match(response.body.answer, /đổi trả/i);
});

test('returns a helpful fallback when no product matches', async () => {
  const { createApp } = require('../src/app');
  delete process.env.GEMINI_API_KEY;

  const response = await request(createApp())
    .post('/api/ai/chat')
    .set('Authorization', `Bearer ${tokenFor(1)}`)
    .send({ message: 'Tôi cần giày nữ size 35 dưới 100 nghìn' })
    .expect(200);

  assert.deepEqual(response.body.products, []);
  assert.deepEqual(response.body.sources, []);
  assert.equal(
    response.body.answer,
    'Hiện trợ lý AI chưa được cấu hình đầy đủ. Anh có thể xem sản phẩm trên trang danh sách hoặc quay lại sau khi admin bật Gemini.'
  );
});

test('returns 400 JSON when AI chat body is empty', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .post('/api/ai/chat')
    .set('Authorization', `Bearer ${tokenFor(1)}`)
    .send()
    .expect(400);

  assert.deepEqual(response.body, { message: 'Message is required', details: null });
});

test('does not persist product advice messages', async () => {
  const { createApp } = require('../src/app');
  retrievalRows = productRetrievalRows;

  await request(createApp())
    .post('/api/ai/chat')
    .set('Authorization', `Bearer ${tokenFor(1)}`)
    .send({ message: 'Tôi cần giày leo núi' })
    .expect(200);

  assert.equal(storedMessages.length, 0);
});
