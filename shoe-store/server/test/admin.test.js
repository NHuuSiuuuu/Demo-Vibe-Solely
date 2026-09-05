const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const originalLoad = Module._load;

process.env.JWT_SECRET = 'test-jwt-secret';

let users;
let products;
let variants;
let orders;
let orderItems;
let nextProductId;
let nextVariantId;

function resetStore() {
  users = [
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
  products = [
    {
      id: 10,
      slug: 'road-runner-1',
      name: 'Road Runner 1',
      description: 'Daily running shoe',
      brand: 'Stride',
      category: 'Running',
      gender: 'unisex',
      base_price: '89.99',
      status: 'active',
      featured: false,
      created_at: '2026-09-05T00:00:00.000Z',
      updated_at: '2026-09-05T00:00:00.000Z'
    }
  ];
  variants = [
    {
      id: 101,
      product_id: 10,
      sku: 'RR1-9-BLK',
      size: '9',
      color: 'Black',
      stock_quantity: 5,
      price_delta: '0.00'
    }
  ];
  orders = [
    {
      id: 900,
      user_id: 1,
      customer_email: 'customer@example.com',
      customer_name: 'Sample Customer',
      shipping_address_line1: '1 Main St',
      shipping_address_line2: null,
      shipping_city: 'Austin',
      shipping_state: 'TX',
      shipping_postal_code: '78701',
      shipping_country: 'US',
      subtotal: '89.99',
      shipping_total: '0.00',
      tax_total: '0.00',
      grand_total: '89.99',
      order_status: 'pending',
      payment_method: 'cod',
      payment_status: 'unpaid',
      created_at: '2026-09-05T00:00:00.000Z',
      updated_at: '2026-09-05T00:00:00.000Z'
    }
  ];
  orderItems = [
    {
      id: 1,
      order_id: 900,
      product_id: 10,
      product_variant_id: 101,
      product_name: 'Road Runner 1',
      sku: 'RR1-9-BLK',
      size: '9',
      color: 'Black',
      unit_price: '89.99',
      quantity: 1,
      line_total: '89.99'
    }
  ];
  nextProductId = 11;
  nextVariantId = 102;
}

function tokenFor(userId) {
  const user = users.find((candidate) => candidate.id === userId);
  return jwt.sign({ sub: String(user.id), role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function publicUserRow(user) {
  return user ? { ...user } : null;
}

function productRow(product) {
  return product ? { ...product } : null;
}

function variantRow(variant) {
  return variant ? { ...variant } : null;
}

function orderRow(order) {
  return order ? { ...order } : null;
}

function orderItemRows(orderId) {
  return orderItems.filter((item) => item.order_id === Number(orderId)).map((item) => ({ ...item }));
}

async function mockQuery(text, params = []) {
  if (text.includes('FROM users') && text.includes('WHERE id = $1')) {
    const user = users.find((candidate) => String(candidate.id) === String(params[0]));
    return { rows: user ? [publicUserRow(user)] : [], rowCount: user ? 1 : 0 };
  }

  if (text.includes('AS products_count') && text.includes('AS completed_revenue')) {
    const completedRevenue = orders
      .filter((order) => order.order_status === 'completed')
      .reduce((sum, order) => sum + Number(order.grand_total), 0);
    return {
      rows: [
        {
          products_count: products.length,
          variants_count: variants.length,
          orders_count: orders.length,
          pending_orders_count: orders.filter((order) => order.order_status === 'pending').length,
          completed_revenue: completedRevenue.toFixed(2)
        }
      ],
      rowCount: 1
    };
  }

  if (text.includes('FROM products p') && text.includes('ORDER BY p.created_at DESC')) {
    return { rows: products.map(productRow), rowCount: products.length };
  }

  if (text.includes('FROM product_variants') && text.includes('WHERE product_id = ANY')) {
    const productIds = new Set((params[0] || []).map(Number));
    const rows = variants.filter((variant) => productIds.has(variant.product_id)).map(variantRow);
    return { rows, rowCount: rows.length };
  }

  if (text.includes('FROM products p') && text.includes('WHERE p.id = $1')) {
    const product = products.find((candidate) => candidate.id === Number(params[0]));
    return { rows: product ? [productRow(product)] : [], rowCount: product ? 1 : 0 };
  }

  if (text.includes('FROM products') && text.includes('WHERE id = $1')) {
    const product = products.find((candidate) => candidate.id === Number(params[0]));
    return { rows: product ? [{ id: product.id }] : [], rowCount: product ? 1 : 0 };
  }

  if (text.includes('INSERT INTO products')) {
    const [slug, name, description, brand, category, gender, basePrice, status, featured] = params;
    const product = {
      id: nextProductId++,
      slug,
      name,
      description,
      brand,
      category,
      gender,
      base_price: basePrice,
      status,
      featured,
      created_at: '2026-09-05T00:00:00.000Z',
      updated_at: '2026-09-05T00:00:00.000Z'
    };
    products.push(product);
    return { rows: [productRow(product)], rowCount: 1 };
  }

  if (text.includes('UPDATE products') && text.includes('WHERE id = $')) {
    const product = products.find((candidate) => candidate.id === Number(params.at(-1)));
    if (!product) {
      return { rows: [], rowCount: 0 };
    }

    const assignments = text.match(/SET([\s\S]*?)WHERE id =/)[1];
    const fields = [
      ['slug', 'slug'],
      ['name', 'name'],
      ['description', 'description'],
      ['brand', 'brand'],
      ['category', 'category'],
      ['gender', 'gender'],
      ['base_price', 'base_price'],
      ['status', 'status'],
      ['featured', 'featured']
    ];
    let paramIndex = 0;
    for (const [sqlName, propertyName] of fields) {
      if (assignments.includes(`${sqlName} = $`)) {
        product[propertyName] = params[paramIndex++];
      }
    }
    product.updated_at = '2026-09-05T00:00:00.000Z';
    return { rows: [productRow(product)], rowCount: 1 };
  }

  if (text.includes('INSERT INTO product_variants')) {
    const [productId, sku, size, color, stockQuantity, priceDelta] = params;
    const variant = {
      id: nextVariantId++,
      product_id: Number(productId),
      sku,
      size,
      color,
      stock_quantity: Number(stockQuantity),
      price_delta: priceDelta
    };
    variants.push(variant);
    return { rows: [variantRow(variant)], rowCount: 1 };
  }

  if (text.includes('UPDATE product_variants') && text.includes('WHERE id = $')) {
    const variant = variants.find((candidate) => candidate.id === Number(params.at(-1)));
    if (!variant) {
      return { rows: [], rowCount: 0 };
    }

    const assignments = text.match(/SET([\s\S]*?)WHERE id =/)[1];
    const fields = [
      ['sku', 'sku'],
      ['size', 'size'],
      ['color', 'color'],
      ['stock_quantity', 'stock_quantity'],
      ['price_delta', 'price_delta']
    ];
    let paramIndex = 0;
    for (const [sqlName, propertyName] of fields) {
      if (assignments.includes(`${sqlName} = $`)) {
        variant[propertyName] = sqlName === 'stock_quantity' ? Number(params[paramIndex++]) : params[paramIndex++];
      }
    }
    return { rows: [variantRow(variant)], rowCount: 1 };
  }

  if (text.includes('FROM orders') && text.includes('ORDER BY created_at DESC')) {
    return { rows: orders.map(orderRow), rowCount: orders.length };
  }

  if (text.includes('FROM orders') && text.includes('WHERE id = $1') && text.includes('FOR UPDATE')) {
    const order = orders.find((candidate) => candidate.id === Number(params[0]));
    return { rows: order ? [orderRow(order)] : [], rowCount: order ? 1 : 0 };
  }

  if (text.includes('FROM orders') && text.includes('WHERE id = $1')) {
    const order = orders.find((candidate) => candidate.id === Number(params[0]));
    return { rows: order ? [orderRow(order)] : [], rowCount: order ? 1 : 0 };
  }

  if (text.includes('FROM order_items') && text.includes('WHERE order_id = $1')) {
    const rows = orderItemRows(params[0]);
    return { rows, rowCount: rows.length };
  }

  if (text.includes('UPDATE orders') && text.includes('order_status = $1')) {
    const order = orders.find((candidate) => candidate.id === Number(params[1]));
    if (!order) {
      return { rows: [], rowCount: 0 };
    }
    order.order_status = params[0];
    if (text.includes("THEN 'paid'")) {
      order.payment_status = 'paid';
    }
    order.updated_at = '2026-09-05T00:00:00.000Z';
    return { rows: [orderRow(order)], rowCount: 1 };
  }

  throw new Error(`Unexpected SQL in admin test: ${text}`);
}

Module._load = function patchedLoad(requestPath, parent, isMain) {
  if (requestPath === '../../db/pool' || requestPath.endsWith('/db/pool')) {
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
  resetStore();
});

test('rejects customer access to admin dashboard with 403', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .get('/api/admin/dashboard')
    .set('Authorization', `Bearer ${tokenFor(1)}`)
    .expect(403);

  assert.deepEqual(response.body, { message: 'Admin access required', details: null });
});

test('returns dashboard totals for admin', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .get('/api/admin/dashboard')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .expect(200);

  assert.deepEqual(response.body.dashboard, {
    productsCount: 1,
    variantsCount: 1,
    ordersCount: 1,
    pendingOrdersCount: 1,
    completedRevenue: 0
  });
});

test('creates and updates a product', async () => {
  const { createApp } = require('../src/app');
  const token = tokenFor(2);

  const createResponse = await request(createApp())
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      slug: 'court-classic-low',
      name: 'Court Classic Low',
      description: 'Low profile court shoe',
      brand: 'Stride',
      category: 'Lifestyle',
      gender: 'unisex',
      price: 74.99,
      status: 'active',
      featured: true
    })
    .expect(201);

  assert.equal(createResponse.body.product.name, 'Court Classic Low');
  assert.equal(createResponse.body.product.price, 74.99);

  const updateResponse = await request(createApp())
    .patch(`/api/admin/products/${createResponse.body.product.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Court Classic LX', price: 79.99, status: 'hidden' })
    .expect(200);

  assert.equal(updateResponse.body.product.name, 'Court Classic LX');
  assert.equal(updateResponse.body.product.price, 79.99);
  assert.equal(updateResponse.body.product.status, 'hidden');
});

test('lists admin products with authoritative variants and totalStock', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .get('/api/admin/products')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .expect(200);

  assert.equal(response.body.products[0].totalStock, 5);
  assert.deepEqual(response.body.products[0].variants, [
    {
      id: 101,
      productId: 10,
      sku: 'RR1-9-BLK',
      size: '9',
      color: 'Black',
      stockQuantity: 5,
      priceDelta: 0
    }
  ]);
});

test('returns one admin product with authoritative variants and totalStock', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .get('/api/admin/products/10')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .expect(200);

  assert.equal(response.body.product.totalStock, 5);
  assert.equal(response.body.product.variants[0].sku, 'RR1-9-BLK');
});

test('rejects invalid product price with 400 JSON', async () => {
  const { createApp } = require('../src/app');
  const token = tokenFor(2);
  const invalidPrices = [null, '', '   ', [], {}, 'abc', -1, false];

  for (const [index, price] of invalidPrices.entries()) {
    const response = await request(createApp())
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: `invalid-price-${index}`,
        name: `Invalid Price ${index}`,
        description: 'Invalid product price fixture',
        brand: 'Stride',
        category: 'Running',
        gender: 'unisex',
        price,
        status: 'active',
        featured: false
      })
      .expect(400);

    assert.deepEqual(response.body, { message: 'Price must be nonnegative', details: null });
  }
});

test('creates and updates a product variant', async () => {
  const { createApp } = require('../src/app');
  const token = tokenFor(2);

  const createResponse = await request(createApp())
    .post('/api/admin/products/10/variants')
    .set('Authorization', `Bearer ${token}`)
    .send({ sku: 'RR1-10-WHT', size: '10', color: 'White', stockQuantity: 8, priceDelta: 5 })
    .expect(201);

  assert.equal(createResponse.body.variant.sku, 'RR1-10-WHT');
  assert.equal(createResponse.body.variant.stockQuantity, 8);

  const updateResponse = await request(createApp())
    .patch(`/api/admin/variants/${createResponse.body.variant.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ color: 'Cream', stockQuantity: 6 })
    .expect(200);

  assert.equal(updateResponse.body.variant.color, 'Cream');
  assert.equal(updateResponse.body.variant.stockQuantity, 6);

  await request(createApp())
    .post('/api/admin/products/999/variants')
    .set('Authorization', `Bearer ${token}`)
    .send({ sku: 'MISSING-10-WHT', size: '10', color: 'White', stockQuantity: 1, priceDelta: 0 })
    .expect(404);
});

test('rejects invalid variant stock with 400 JSON', async () => {
  const { createApp } = require('../src/app');
  const token = tokenFor(2);
  const invalidStocks = [null, '', '   ', [], {}, 'abc', -1, 1.5, false];

  for (const [index, stockQuantity] of invalidStocks.entries()) {
    const response = await request(createApp())
      .post('/api/admin/products/10/variants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sku: `BAD-STOCK-${index}`,
        size: '10',
        color: 'White',
        stockQuantity,
        priceDelta: 0
      })
      .expect(400);

    assert.deepEqual(response.body, { message: 'Stock quantity must be nonnegative', details: null });
  }
});

test('lists all orders for admin', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .get('/api/admin/orders')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .expect(200);

  assert.deepEqual(response.body.orders.map((order) => order.id), [900]);
});

test('moves order pending to confirmed to shipping to completed', async () => {
  const { createApp } = require('../src/app');
  const token = tokenFor(2);

  const confirmed = await request(createApp())
    .patch('/api/admin/orders/900/status')
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'confirmed' })
    .expect(200);
  assert.equal(confirmed.body.order.orderStatus, 'confirmed');

  const shipping = await request(createApp())
    .patch('/api/admin/orders/900/status')
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'shipping' })
    .expect(200);
  assert.equal(shipping.body.order.orderStatus, 'shipping');

  const completed = await request(createApp())
    .patch('/api/admin/orders/900/status')
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'completed' })
    .expect(200);
  assert.equal(completed.body.order.orderStatus, 'completed');
});

test('sets payment_status paid when order is completed', async () => {
  const { createApp } = require('../src/app');
  const token = tokenFor(2);

  await request(createApp())
    .patch('/api/admin/orders/900/status')
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'confirmed' })
    .expect(200);
  await request(createApp())
    .patch('/api/admin/orders/900/status')
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'shipping' })
    .expect(200);
  const response = await request(createApp())
    .patch('/api/admin/orders/900/status')
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'completed' })
    .expect(200);

  assert.equal(response.body.order.paymentStatus, 'paid');
});

test('rejects invalid order status transition with 400', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .patch('/api/admin/orders/900/status')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .send({ status: 'shipping' })
    .expect(400);

  assert.deepEqual(response.body, { message: 'Invalid order status transition', details: null });
});
