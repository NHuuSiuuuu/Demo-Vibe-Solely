const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const originalLoad = Module._load;
process.env.JWT_SECRET = 'test-jwt-secret';
let searchHandler;
let overviewHandler;
let reindexAllHandler;
let reindexProductHandler;
let searchCalls;
let reindexProductCalls;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ADMIN_IMAGE_ENDPOINTS = [
  { method: 'get', path: '/api/admin/rag/image-overview' },
  { method: 'post', path: '/api/admin/rag/images/reindex' },
  { method: 'post', path: '/api/admin/rag/products/10/image-reindex' }
];

const users = {
  1: { id: 1, email: 'customer@example.com', role: 'customer', first_name: 'Test', last_name: 'Customer' },
  2: { id: 2, email: 'admin@example.com', role: 'admin', first_name: 'Test', last_name: 'Admin' }
};

Module._load = function patchedLoad(requestPath, parent, isMain) {
  if (requestPath === '../../db/pool' || requestPath.endsWith('/db/pool')) {
    return {
      query: async (_text, params = []) => {
        const user = users[Number(params[0])];
        return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
      },
      pool: { connect: async () => { throw new Error('Unexpected transaction'); } }
    };
  }
  if (requestPath === '../imageSearch/imageSearch.service' || requestPath.endsWith('/modules/imageSearch/imageSearch.service')) {
    return {
      async searchProductsByImage(input) { searchCalls.push(input); return searchHandler(input); },
      async getImageEmbeddingOverview() { return overviewHandler(); },
      async reindexAllProductImages() { return reindexAllHandler(); },
      async reindexProductImages(id) { return reindexProductHandler(id); },
      async indexProductImage() {}
    };
  }
  return originalLoad.call(this, requestPath, parent, isMain);
};

const { createApp } = require('../src/app');

function auth(userId) {
  return `Bearer ${jwt.sign({ sub: String(userId), role: users[userId].role }, process.env.JWT_SECRET)}`;
}

test.beforeEach(() => {
  searchCalls = [];
  reindexProductCalls = [];
  searchHandler = async () => ({ products: [{ id: 10, name: 'Runner' }], threshold: 0.35 });
  overviewHandler = async () => ({ totalImages: 14, indexedCount: 10, errorCount: 2, needsReindexCount: 1, model: 'gemini-embedding-2', dimension: 768, lastIndexedAt: null });
  reindexAllHandler = async () => ({ indexed: 10, failed: 2 });
  reindexProductHandler = async (id) => {
    reindexProductCalls.push(id);
    return { indexed: 2, failed: 1 };
  };
});

test.after(() => { Module._load = originalLoad; });

test('image search route returns products and passes only supported filters', async () => {
  const image = Buffer.from('png-image');
  const response = await request(createApp())
    .post('/api/products/search-by-image')
    .field('brand', 'Solely').field('gender', 'women').field('size', '38').field('color', 'white')
    .field('minPrice', '1000000').field('maxPrice', '2500000').field('category', 'ignored')
    .attach('image', image, { filename: 'shoe.png', contentType: 'image/png' })
    .expect(200);

  assert.deepEqual(response.body, { products: [{ id: 10, name: 'Runner' }], query: { type: 'image' }, threshold: 0.35 });
  assert.deepEqual(searchCalls, [{ data: image, mimeType: 'image/png', filters: { brand: 'Solely', gender: 'women', size: '38', color: 'white', minPrice: '1000000', maxPrice: '2500000' } }]);
});

test('image search route rejects a missing image', async () => {
  const response = await request(createApp()).post('/api/products/search-by-image').field('brand', 'Solely').expect(400);
  assert.match(response.body.message, /required/i);
  assert.equal(searchCalls.length, 0);
});

test('image search route rejects unsupported MIME types', async () => {
  const response = await request(createApp()).post('/api/products/search-by-image')
    .attach('image', Buffer.from('gif'), { filename: 'shoe.gif', contentType: 'image/gif' }).expect(400);
  assert.match(response.body.message, /JPEG or PNG/i);
  assert.equal(searchCalls.length, 0);
});

test('image search route accepts an image exactly at the 8 MB limit', async () => {
  const image = Buffer.alloc(MAX_IMAGE_BYTES, 1);
  await request(createApp())
    .post('/api/products/search-by-image')
    .attach('image', image, { filename: 'shoe.png', contentType: 'image/png' })
    .expect(200);

  assert.equal(searchCalls.length, 1);
  assert.equal(searchCalls[0].data.length, MAX_IMAGE_BYTES);
});

test('image search route rejects an image larger than 8 MB without calling the service', async () => {
  const response = await request(createApp())
    .post('/api/products/search-by-image')
    .attach('image', Buffer.alloc(MAX_IMAGE_BYTES + 1, 1), { filename: 'shoe.png', contentType: 'image/png' })
    .expect(400);

  assert.deepEqual(response.body, { message: 'Image must not exceed 8 MB', details: null });
  assert.equal(searchCalls.length, 0);
});

test('image search route maps unexpected and duplicate multipart files to stable 400 JSON', async () => {
  const unexpected = await request(createApp())
    .post('/api/products/search-by-image')
    .attach('other', Buffer.from('png'), { filename: 'other.png', contentType: 'image/png' })
    .expect(400);
  assert.deepEqual(unexpected.body, { message: 'Invalid image upload', details: null });

  const duplicate = await request(createApp())
    .post('/api/products/search-by-image')
    .attach('image', Buffer.from('png'), { filename: 'one.png', contentType: 'image/png' })
    .attach('image', Buffer.from('png'), { filename: 'two.png', contentType: 'image/png' })
    .expect(400);
  assert.deepEqual(duplicate.body, { message: 'Invalid image upload', details: null });
  assert.equal(searchCalls.length, 0);
});

test('image search route returns a stable unavailable error when the provider fails', async () => {
  searchHandler = async () => { throw new Error('secret provider response'); };
  const response = await request(createApp()).post('/api/products/search-by-image')
    .attach('image', Buffer.from('jpeg'), { filename: 'shoe.jpg', contentType: 'image/jpeg' }).expect(503);
  assert.deepEqual(response.body, { message: 'Image search is temporarily unavailable', details: null });
});

test('all image reindex admin routes require authentication and admin role', async () => {
  for (const endpoint of ADMIN_IMAGE_ENDPOINTS) {
    await request(createApp())[endpoint.method](endpoint.path).expect(401);
    await request(createApp())[endpoint.method](endpoint.path).set('Authorization', auth(1)).expect(403);
  }
});

test('image reindex admin routes return overview and reindex counts with the product id', async () => {
  const app = createApp();
  const header = auth(2);
  const overview = await request(app).get('/api/admin/rag/image-overview').set('Authorization', header).expect(200);
  const all = await request(app).post('/api/admin/rag/images/reindex').set('Authorization', header).expect(200);
  const product = await request(app).post('/api/admin/rag/products/10/image-reindex').set('Authorization', header).expect(200);
  assert.equal(overview.body.overview.dimension, 768);
  assert.deepEqual(all.body.summary, { indexed: 10, failed: 2 });
  assert.deepEqual(product.body.summary, { indexed: 2, failed: 1 });
  assert.deepEqual(reindexProductCalls, ['10']);
});

test('all image reindex admin handlers return stable 503 JSON on failure', async () => {
  overviewHandler = async () => { throw new Error('provider secret'); };
  reindexAllHandler = async () => { throw new Error('provider secret'); };
  reindexProductHandler = async () => { throw new Error('provider secret'); };

  for (const endpoint of ADMIN_IMAGE_ENDPOINTS) {
    const response = await request(createApp())[endpoint.method](endpoint.path)
      .set('Authorization', auth(2))
      .expect(503);
    assert.deepEqual(response.body, { message: 'Image indexing is temporarily unavailable', details: null });
  }
});
