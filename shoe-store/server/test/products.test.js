const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const request = require('supertest');

const originalLoad = Module._load;

const productCards = [
  {
    id: '1',
    name: 'Road Runner 1',
    slug: 'road-runner-1',
    brand: 'Stride',
    category: 'running',
    gender: 'men',
    price: '89.99',
    imageUrl: '/images/road-runner-1-main.jpg',
    availableSizes: ['9', '10'],
    availableColors: ['black', 'white'],
    totalStock: '8'
  },
  {
    id: '2',
    name: 'Court Classic',
    slug: 'court-classic',
    brand: 'Ace',
    category: 'lifestyle',
    gender: 'women',
    price: '74.50',
    imageUrl: '/images/court-classic-main.jpg',
    availableSizes: ['7', '8'],
    availableColors: ['white', 'red'],
    totalStock: '6'
  }
];

const productDetail = {
  id: '1',
  name: 'Road Runner 1',
  slug: 'road-runner-1',
  description: 'Lightweight road running shoe.',
  brand: 'Stride',
  category: 'running',
  gender: 'men',
  price: '89.99',
  images: [
    { id: '11', imageUrl: '/images/road-runner-1-main.jpg', altText: 'Road Runner 1 side view', sortOrder: 0 },
    { id: '12', imageUrl: '/images/road-runner-1-sole.jpg', altText: 'Road Runner 1 sole', sortOrder: 1 }
  ],
  variants: [
    { id: '101', sku: 'RR1-9-BLK', size: '9', color: 'black', stockQuantity: 5, priceDelta: '0.00' },
    { id: '102', sku: 'RR1-10-WHT', size: '10', color: 'white', stockQuantity: 3, priceDelta: '5.00' }
  ]
};

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
  if (text.includes('FROM products p') && text.includes('WHERE p.slug = $1')) {
    return { rows: params[0] === 'road-runner-1' ? [productDetail] : [], rowCount: params[0] === 'road-runner-1' ? 1 : 0 };
  }

  if (text.includes('FROM products p') && text.includes("p.status = 'active'")) {
    if (params.includes('%runner%')) {
      assert.match(text, /ILIKE/);
      return { rows: [productCards[0]], rowCount: 1 };
    }

    if (params.includes('9') && params.includes('black')) {
      assert.match(text, /EXISTS[\s\S]*product_variants/);
      return { rows: [productCards[0]], rowCount: 1 };
    }

    if (text.includes('ORDER BY price ASC')) {
      return { rows: [productCards[1], productCards[0]], rowCount: 2 };
    }

    return { rows: productCards, rowCount: productCards.length };
  }

  throw new Error(`Unexpected SQL in products test: ${text}`);
}

Module._load = function patchedLoad(requestPath, parent, isMain) {
  if (requestPath === '../../db/pool' || requestPath.endsWith('/db/pool')) {
    return { query: mockQuery, pool: { connect: async () => ({ query: mockQuery, release() {} }) } };
  }

  return originalLoad.call(this, requestPath, parent, isMain);
};

test.after(() => {
  Module._load = originalLoad;
});

test('lists active products with images and available variants', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp()).get('/api/products').expect(200);

  assert.deepEqual(response.body.products, productCards.map(normalizeCard));
});

test('filters products by keyword', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp()).get('/api/products?q=runner').expect(200);

  assert.deepEqual(response.body.products, [normalizeCard(productCards[0])]);
});

test('filters products by size and color', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp()).get('/api/products?size=9&color=black').expect(200);

  assert.deepEqual(response.body.products, [normalizeCard(productCards[0])]);
});

test('sorts products by price ascending', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp()).get('/api/products?sort=price_asc').expect(200);

  assert.deepEqual(response.body.products, [normalizeCard(productCards[1]), normalizeCard(productCards[0])]);
});

test('returns one product by slug', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp()).get('/api/products/road-runner-1').expect(200);

  assert.deepEqual(response.body.product, {
    id: 1,
    name: 'Road Runner 1',
    slug: 'road-runner-1',
    description: 'Lightweight road running shoe.',
    brand: 'Stride',
    category: 'running',
    gender: 'men',
    price: 89.99,
    images: [
      { id: 11, imageUrl: '/images/road-runner-1-main.jpg', altText: 'Road Runner 1 side view', sortOrder: 0 },
      { id: 12, imageUrl: '/images/road-runner-1-sole.jpg', altText: 'Road Runner 1 sole', sortOrder: 1 }
    ],
    variants: [
      { id: 101, sku: 'RR1-9-BLK', size: '9', color: 'black', stockQuantity: 5, priceDelta: 0 },
      { id: 102, sku: 'RR1-10-WHT', size: '10', color: 'white', stockQuantity: 3, priceDelta: 5 }
    ]
  });
});

test('returns 404 JSON for missing slug', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp()).get('/api/products/missing-shoe').expect(404);

  assert.equal(response.headers['content-type'].startsWith('application/json'), true);
  assert.deepEqual(response.body, { message: 'Product not found', details: null });
});
