const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const request = require('supertest');

const originalLoad = Module._load;
let lastProductListQuery = '';

const productCards = [
  {
    id: '1',
    name: 'Road Runner 1',
    slug: 'road-runner-1',
    brand: 'Stride',
    category: 'running',
    gender: 'men',
    basePrice: '100.00',
    discountPercent: '50.00',
    legacyPriceDelta: null,
    expectedPrice: 50,
    imageUrl: '/images/road-runner-1-main.jpg',
    availableSizes: ['9', '10'],
    availableColors: ['black', 'white'],
    totalStock: '8',
    defaultVariantId: '101',
    defaultVariantStock: '5'
  },
  {
    id: '2',
    name: 'Court Classic',
    slug: 'court-classic',
    brand: 'Ace',
    category: 'lifestyle',
    gender: 'women',
    basePrice: '80.00',
    discountPercent: '0.00',
    legacyPriceDelta: null,
    expectedPrice: 80,
    imageUrl: '/images/court-classic-main.jpg',
    availableSizes: ['7', '8'],
    availableColors: ['white', 'red'],
    totalStock: '6',
    defaultVariantId: '201',
    defaultVariantStock: '4'
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
    { id: '101', sku: 'RR1-9-BLK', size: '9', color: 'black', stockQuantity: 5, discountPercent: '0.00', legacyPriceDelta: null },
    { id: '102', sku: 'RR1-10-WHT', size: '10', color: 'white', stockQuantity: 3, discountPercent: '10.00', legacyPriceDelta: '5.00' }
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
    price: row.expectedPrice,
    discountPercent: Number(row.discountPercent),
    imageUrl: row.imageUrl,
    availableSizes: row.availableSizes,
    availableColors: row.availableColors,
    totalStock: Number(row.totalStock),
    defaultVariantId: Number(row.defaultVariantId),
    defaultVariantStock: Number(row.defaultVariantStock)
  };
}

async function mockQuery(text, params = []) {
  if (text.includes('FROM products p') && text.includes('WHERE p.slug = $1')) {
    assert.match(text, /pv\.discount_percent/);
    assert.doesNotMatch(text, /'priceDelta'/);
    return { rows: params[0] === 'road-runner-1' ? [productDetail] : [], rowCount: params[0] === 'road-runner-1' ? 1 : 0 };
  }

  if (text.includes('FROM products p') && text.includes("p.status = 'active'")) {
    lastProductListQuery = text;
    assert.match(text, /default_variant\.discount_percent/);
    assert.match(text, /"basePrice"/);
    if (params.includes('%runner%')) {
      assert.match(text, /ILIKE/);
      return { rows: [productCards[0]], rowCount: 1 };
    }

    if (params.includes('9') && params.includes('black')) {
      assert.deepEqual(params, ['9', 'black']);
      assert.match(text, /FROM product_variants source_variant[\s\S]*pv\.size = \$1[\s\S]*LOWER\(pv\.color\) = LOWER\(\$2\)/);
      assert.match(text, /default_variant\.id IS NOT NULL/);
      return { rows: [productCards[0]], rowCount: 1 };
    }

    if (params.includes('10') && params.includes('95.00')) {
      if (text.includes('p.base_price <= ')) {
        return { rows: [], rowCount: 0 };
      }

      assert.match(text, /pv\.size = \$1/);
      assert.match(text, /displayed_price[\s\S]*<= \$2/);
      assert.match(text, /default_variant\.id IS NOT NULL/);
      return {
        rows: [{
          ...productCards[0],
          discountPercent: '10.00',
          expectedPrice: 90,
          defaultVariantId: '102',
          defaultVariantStock: '3'
        }],
        rowCount: 1
      };
    }

    if (params.includes('40.00') && params.includes('60.00')) {
      if (text.includes('p.base_price <= ')) {
        return { rows: [], rowCount: 0 };
      }

      assert.match(text, /pv\.displayed_price >= \$1/);
      assert.match(text, /pv\.displayed_price <= \$2/);
      return { rows: [productCards[0]], rowCount: 1 };
    }

    if (text.includes('ORDER BY p.base_price ASC')) {
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

test('filters products by size and color on the same available variant', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp()).get('/api/products?size=9&color=black').expect(200);

  assert.deepEqual(response.body.products, [normalizeCard(productCards[0])]);
});

test('sorts products by price ascending', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp()).get('/api/products?sort=price_asc').expect(200);

  assert.deepEqual(response.body.products, [normalizeCard(productCards[0]), normalizeCard(productCards[1])]);
  assert.match(lastProductListQuery, /ORDER BY COALESCE\(default_variant\.displayed_price, p\.base_price\) ASC/);
  assert.doesNotMatch(lastProductListQuery, /ORDER BY p\.base_price ASC/);
});

test('filters products by the displayed discounted price range', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp()).get('/api/products?minPrice=40&maxPrice=60').expect(200);

  assert.deepEqual(response.body.products, [normalizeCard(productCards[0])]);
});

test('uses the matching variant for size, displayed price, and card fields', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp()).get('/api/products?size=10&maxPrice=95').expect(200);

  assert.deepEqual(response.body.products, [{
    ...normalizeCard(productCards[0]),
    price: 90,
    discountPercent: 10,
    defaultVariantId: 102,
    defaultVariantStock: 3
  }]);
});

test('returns 400 JSON for invalid numeric price filters', async () => {
  const { createApp } = require('../src/app');

  for (const filter of ['minPrice=abc', 'maxPrice=-10', 'minPrice=', 'maxPrice=false']) {
    const response = await request(createApp()).get(`/api/products?${filter}`).expect(400);

    assert.deepEqual(response.body, { message: 'Price filter must be a nonnegative number', details: null });
  }
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
      { id: 101, sku: 'RR1-9-BLK', size: '9', color: 'black', stockQuantity: 5, discountPercent: 0, unitPrice: 89.99 },
      { id: 102, sku: 'RR1-10-WHT', size: '10', color: 'white', stockQuantity: 3, discountPercent: 10, unitPrice: 80.99 }
    ]
  });
});

test('returns 404 JSON for missing slug', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp()).get('/api/products/missing-shoe').expect(404);

  assert.equal(response.headers['content-type'].startsWith('application/json'), true);
  assert.deepEqual(response.body, { message: 'Product not found', details: null });
});
