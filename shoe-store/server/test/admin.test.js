const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const originalLoad = Module._load;
const originalFetch = global.fetch;
const originalGeminiApiKey = process.env.GEMINI_API_KEY;

process.env.JWT_SECRET = 'test-jwt-secret';

let users;
let products;
let variants;
let orders;
let orderItems;
let ragDocuments;
let nextProductId;
let nextDocumentId;
let nextVariantId;
let restoredStockUpdates;
let queryLog;
let ragReindexCalls;
let ragReindexShouldFail;
let ragDocumentReindexCalls;
let ragDocumentReindexShouldFail;
let ragChunkStatusUpdates;
let ragChunkUpdateShouldFail;
let ragDocumentStatusUpdates;
let ragOverviewUnavailable;

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
      discount_percent: '10.00'
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
      note: 'Ring bell',
      order_code: 'ORD-900',
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
  ragDocuments = [
    {
      id: 7,
      title: 'Chính sách đổi trả',
      slug: 'chinh-sach-doi-tra',
      document_type: 'returns',
      content: 'Khách có thể đổi trả khi giày còn nguyên hộp.',
      status: 'active',
      last_indexed_at: '2026-09-05T12:00:00.000Z',
      created_at: '2026-09-05T00:00:00.000Z',
      updated_at: '2026-09-05T00:00:00.000Z'
    }
  ];
  nextProductId = 11;
  nextDocumentId = 8;
  nextVariantId = 102;
  restoredStockUpdates = [];
  ragReindexCalls = [];
  ragReindexShouldFail = false;
  ragDocumentReindexCalls = [];
  ragDocumentReindexShouldFail = false;
  ragChunkStatusUpdates = [];
  ragChunkUpdateShouldFail = false;
  ragDocumentStatusUpdates = [];
  ragOverviewUnavailable = false;
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
  queryLog.push({ text, params });

  if (text.includes('FROM users') && text.includes('WHERE id = $1')) {
    const user = users.find((candidate) => String(candidate.id) === String(params[0]));
    return { rows: user ? [publicUserRow(user)] : [], rowCount: user ? 1 : 0 };
  }

  if (text.includes('AS products_count') && text.includes('AS completed_revenue')) {
    const completedRevenue = orders
      .filter((order) => order.payment_status === 'paid')
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

  if (text.includes('to_regclass') && text.includes('rag_documents') && text.includes('rag_chunks')) {
    return {
      rows: [
        {
          has_documents_table: !ragOverviewUnavailable,
          has_chunks_table: !ragOverviewUnavailable
        }
      ],
      rowCount: 1
    };
  }

  if (text.includes('pg_extension') && text.includes("extname = 'vector'")) {
    return { rows: [{ available: !ragOverviewUnavailable }], rowCount: 1 };
  }

  if (text.includes('AS document_count') && text.includes('AS chunk_count')) {
    if (ragOverviewUnavailable) throw new Error('relation "rag_documents" does not exist');
    return {
      rows: [
        {
          document_count: 2,
          chunk_count: 5,
          needs_reindex_count: 1,
          active_document_count: 1,
          hidden_document_count: 0,
          stale_document_count: 1,
          document_chunk_count: 3,
          product_chunk_count: 2,
          indexed_product_count: 1,
          stale_product_count: 1,
          last_indexed_at: '2026-09-05T12:00:00.000Z'
        }
      ],
      rowCount: 1
    };
  }

  if (text.includes('FROM rag_chunks') && text.includes('embedding <=>')) {
    return {
      rows: [
        {
          id: '501',
          source_type: 'document',
          source_id: '7',
          title: 'Chính sách đổi trả',
          content: 'Khách có thể đổi trả khi giày còn nguyên hộp, tem và chưa sử dụng ngoài phạm vi thử size trong nhà.',
          metadata: { documentType: 'returns', slug: 'chinh-sach-doi-tra' },
          score: '0.92'
        }
      ],
      rowCount: 1
    };
  }

  if (text.includes('FROM rag_documents') && text.includes('ORDER BY updated_at DESC')) {
    return { rows: ragDocuments.map((document) => ({ ...document })), rowCount: ragDocuments.length };
  }

  if (text.includes('INSERT INTO rag_documents')) {
    const [title, slug, documentType, content, status] = params;
    const document = {
      id: nextDocumentId++,
      title,
      slug,
      document_type: documentType,
      content,
      status,
      last_indexed_at: null,
      created_at: '2026-09-05T00:00:00.000Z',
      updated_at: '2026-09-05T00:00:00.000Z'
    };
    ragDocuments.push(document);
    return { rows: [{ ...document }], rowCount: 1 };
  }

  if (text.includes('UPDATE rag_documents') && text.includes('WHERE id = $') && text.includes('RETURNING id')) {
    const document = ragDocuments.find((candidate) => candidate.id === Number(params.at(-1)));
    if (!document) return { rows: [], rowCount: 0 };
    const assignments = text.match(/SET([\s\S]*?)WHERE id =/)[1];
    const fields = [
      ['title', 'title'],
      ['slug', 'slug'],
      ['document_type', 'document_type'],
      ['content', 'content'],
      ['status', 'status']
    ];
    let paramIndex = 0;
    for (const [sqlName, propertyName] of fields) {
      if (assignments.includes(`${sqlName} = $`)) {
        document[propertyName] = params[paramIndex++];
      }
    }
    document.updated_at = '2026-09-05T00:00:00.000Z';
    return { rows: [{ ...document }], rowCount: 1 };
  }

  if (text.includes('UPDATE rag_documents') && text.includes("status = 'needs_reindex'")) {
    ragDocumentStatusUpdates.push({ documentId: Number(params[0]), status: 'needs_reindex' });
    const document = ragDocuments.find((candidate) => candidate.id === Number(params[0]));
    if (document) document.status = 'needs_reindex';
    return { rows: [], rowCount: document ? 1 : 0 };
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

  if (text.includes('FROM product_images') && text.includes('WHERE product_id = $1')) {
    return { rows: [], rowCount: 0 };
  }

  if (text.includes('SELECT status') && text.includes('FROM products') && text.includes('WHERE id = $1')) {
    const product = products.find((candidate) => candidate.id === Number(params[0]));
    return { rows: product ? [{ status: product.status }] : [], rowCount: product ? 1 : 0 };
  }

  if (text.includes('FROM products') && text.includes('WHERE id = $1')) {
    const product = products.find((candidate) => candidate.id === Number(params[0]));
    return { rows: product ? [{ id: product.id }] : [], rowCount: product ? 1 : 0 };
  }

  if (text.includes('UPDATE rag_chunks') && text.includes("source_type = 'product'") && text.includes('source_id = $1')) {
    const statusMatch = text.match(/SET status = '([^']+)'/);
    ragChunkStatusUpdates.push({ productId: Number(params[0]), status: statusMatch ? statusMatch[1] : null });
    if (ragChunkUpdateShouldFail) {
      throw new Error('RAG chunk update failed');
    }
    return { rows: [], rowCount: 1 };
  }

  if (text.includes('UPDATE rag_chunks') && text.includes("source_type = 'document'") && text.includes('source_id = $1')) {
    return { rows: [], rowCount: 1 };
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
    const [productId, sku, size, color, stockQuantity, discountPercent] = params;
    const variant = {
      id: nextVariantId++,
      product_id: Number(productId),
      sku,
      size,
      color,
      stock_quantity: Number(stockQuantity),
      discount_percent: discountPercent
    };
    variants.push(variant);
    return { rows: [variantRow(variant)], rowCount: 1 };
  }

  if (text.includes('UPDATE product_variants') && text.includes('stock_quantity = stock_quantity + $1')) {
    const variant = variants.find((candidate) => candidate.id === Number(params[1]));
    if (!variant) {
      return { rows: [], rowCount: 0 };
    }
    variant.stock_quantity += Number(params[0]);
    restoredStockUpdates.push({ variantId: Number(params[1]), quantity: Number(params[0]) });
    return { rows: [{ id: variant.id, stock_quantity: variant.stock_quantity }], rowCount: 1 };
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
      ['discount_percent', 'discount_percent']
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
    const nextStatus = params[2] ?? params[0];
    if (text.includes("payment_method = 'cod'") && nextStatus === 'completed' && order.payment_method === 'cod') {
      order.payment_status = 'paid';
    }
    if (
      text.includes("payment_method = 'vnpay'")
      && nextStatus === 'cancelled'
      && order.payment_method === 'vnpay'
      && order.payment_status === 'pending'
    ) {
      order.payment_status = 'failed';
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

  if (requestPath === '../rag/ragIndex.service' || requestPath === './ragIndex.service' || requestPath.endsWith('/modules/rag/ragIndex.service')) {
    return {
      reindexProduct: async (productId) => {
        ragReindexCalls.push(Number(productId));
        if (ragReindexShouldFail) {
          throw new Error('RAG reindex failed');
        }
        return { status: 'indexed', chunksIndexed: 1 };
      },
      reindexDocument: async (documentId) => {
        ragDocumentReindexCalls.push(Number(documentId));
        if (ragDocumentReindexShouldFail) {
          throw new Error('RAG document reindex failed');
        }
        return { status: 'indexed', chunksIndexed: 1 };
      }
    };
  }

  return originalLoad.call(this, requestPath, parent, isMain);
};

test.after(() => {
  Module._load = originalLoad;
  global.fetch = originalFetch;
  if (originalGeminiApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalGeminiApiKey;
  }
});

test.beforeEach(() => {
  resetStore();
  queryLog = [];
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

test('admin can fetch RAG overview', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .get('/api/admin/rag/overview')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .expect(200);

  assert.equal(typeof response.body.overview.geminiConfigured, 'boolean');
  assert.equal(typeof response.body.overview.documentCount, 'number');
  assert.deepEqual(response.body.overview.documentCountsByStatus, {
    active: 1,
    hidden: 0,
    needsReindex: 1
  });
  assert.deepEqual(response.body.overview.chunkCountsBySourceType, {
    document: 3,
    product: 2
  });
  assert.equal(response.body.overview.indexedProductCount, 1);
  assert.equal(response.body.overview.staleProductCount, 1);
  assert.equal(response.body.overview.lastIndexedAt, '2026-09-05T12:00:00.000Z');
  assert.equal(response.body.overview.pgvectorAvailable, true);
});

test('admin RAG overview reports unavailable tables without a generic 500', async () => {
  const { createApp } = require('../src/app');
  ragOverviewUnavailable = true;

  const response = await request(createApp())
    .get('/api/admin/rag/overview')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .expect(200);

  assert.equal(response.body.overview.available, false);
  assert.equal(response.body.overview.pgvectorAvailable, false);
  assert.match(response.body.overview.message, /RAG tables/i);
});

test('customer cannot access RAG admin endpoints', async () => {
  const { createApp } = require('../src/app');

  await request(createApp())
    .get('/api/admin/rag/overview')
    .set('Authorization', `Bearer ${tokenFor(1)}`)
    .expect(403);
});

test('admin RAG test returns retrieved chunks when context is found', async () => {
  const { createApp } = require('../src/app');
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  global.fetch = async (url) => ({
    ok: true,
    async json() {
      if (String(url).includes(':embedContent')) {
        return { embedding: { values: Array.from({ length: 768 }, () => 0.1) } };
      }
      return { candidates: [{ content: { parts: [{ text: 'Solely hỗ trợ đổi trả theo điều kiện còn nguyên hộp.' }] } }] };
    }
  });

  const response = await request(createApp())
    .post('/api/admin/rag/test')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .send({ message: 'Chính sách đổi trả như thế nào?' })
    .expect(200);

  assert.equal(response.body.answer, 'Solely hỗ trợ đổi trả theo điều kiện còn nguyên hộp.');
  assert.deepEqual(response.body.chunks, [
    {
      id: 501,
      sourceType: 'document',
      sourceId: 7,
      title: 'Chính sách đổi trả',
      content: 'Khách có thể đổi trả khi giày còn nguyên hộp, tem và chưa sử dụng ngoài phạm vi thử size trong nhà.',
      metadata: { documentType: 'returns', slug: 'chinh-sach-doi-tra' },
      score: 0.92
    }
  ]);
});

test('creating an active RAG document reindexes it after the save', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .post('/api/admin/rag/documents')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .send({
      title: 'Thanh toán COD',
      slug: 'thanh-toan-cod',
      documentType: 'payment',
      content: 'Solely hỗ trợ thanh toán COD.',
      status: 'active'
    })
    .expect(201);

  assert.equal(response.body.document.title, 'Thanh toán COD');
  assert.deepEqual(ragDocumentReindexCalls, [8]);
});

test('RAG document save succeeds and marks document needs_reindex when reindex fails', async () => {
  const { createApp } = require('../src/app');
  ragDocumentReindexShouldFail = true;

  const response = await request(createApp())
    .put('/api/admin/rag/documents/7')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .send({
      title: 'Chính sách đổi trả mới',
      slug: 'chinh-sach-doi-tra',
      documentType: 'returns',
      content: 'Nội dung đổi trả cập nhật.',
      status: 'active'
    })
    .expect(200);

  assert.equal(response.body.document.title, 'Chính sách đổi trả mới');
  assert.deepEqual(ragDocumentReindexCalls, [7]);
  assert.deepEqual(ragDocumentStatusUpdates, [{ documentId: 7, status: 'needs_reindex' }]);
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

test('updating a product triggers RAG reindex for that product', async () => {
  const { createApp } = require('../src/app');

  await request(createApp())
    .patch('/api/admin/products/10')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .send({ description: 'Mô tả mới cho giày trail chống trượt.' })
    .expect(200);

  assert.equal(ragReindexCalls.includes(10), true);
});

test('creating a product triggers RAG reindex for the new product', async () => {
  const { createApp } = require('../src/app');

  await request(createApp())
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .send({
      slug: 'trail-grip-pro',
      name: 'Trail Grip Pro',
      description: 'Giày trail chống trượt cho đường mòn ẩm.',
      brand: 'Solely',
      category: 'Trail',
      gender: 'unisex',
      price: 1290000,
      status: 'active',
      featured: false
    })
    .expect(201);

  assert.equal(ragReindexCalls.includes(11), true);
});

test('variant mutations trigger RAG reindex for the affected product', async () => {
  const { createApp } = require('../src/app');
  const token = tokenFor(2);

  const createResponse = await request(createApp())
    .post('/api/admin/products/10/variants')
    .set('Authorization', `Bearer ${token}`)
    .send({ sku: 'RR1-11-NAV', size: '11', color: 'Navy', stockQuantity: 3, discountPercent: 0 })
    .expect(201);

  await request(createApp())
    .patch(`/api/admin/variants/${createResponse.body.variant.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ stockQuantity: 4 })
    .expect(200);

  assert.deepEqual(ragReindexCalls, [10, 10]);
});

test('product save succeeds and marks RAG chunks needs_reindex when reindex fails', async () => {
  const { createApp } = require('../src/app');
  ragReindexShouldFail = true;

  const response = await request(createApp())
    .patch('/api/admin/products/10')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .send({ name: 'Road Runner Trail' })
    .expect(200);

  assert.equal(response.body.product.name, 'Road Runner Trail');
  assert.deepEqual(ragChunkStatusUpdates, [{ productId: 10, status: 'needs_reindex' }]);
});

test('product save still succeeds when RAG fallback bookkeeping fails', async () => {
  const { createApp } = require('../src/app');
  ragReindexShouldFail = true;
  ragChunkUpdateShouldFail = true;

  const response = await request(createApp())
    .patch('/api/admin/products/10')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .send({ name: 'Road Runner Resilient' })
    .expect(200);

  assert.equal(response.body.product.name, 'Road Runner Resilient');
  assert.deepEqual(ragChunkStatusUpdates, [{ productId: 10, status: 'needs_reindex' }]);
});

test('hiding a product marks related RAG chunks hidden', async () => {
  const { createApp } = require('../src/app');

  await request(createApp())
    .patch('/api/admin/products/10')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .send({ status: 'hidden' })
    .expect(200);

  assert.deepEqual(ragReindexCalls, []);
  assert.deepEqual(ragChunkStatusUpdates, [{ productId: 10, status: 'hidden' }]);
});

test('hiding a product still succeeds when hidden RAG bookkeeping fails', async () => {
  const { createApp } = require('../src/app');
  ragChunkUpdateShouldFail = true;

  const response = await request(createApp())
    .patch('/api/admin/products/10')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .send({ status: 'hidden' })
    .expect(200);

  assert.equal(response.body.product.status, 'hidden');
  assert.deepEqual(ragChunkStatusUpdates, [{ productId: 10, status: 'hidden' }]);
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
      discountPercent: 10
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
    .send({ sku: 'RR1-10-WHT', size: '10', color: 'White', stockQuantity: 8, discountPercent: 12.5 })
    .expect(201);

  assert.equal(createResponse.body.variant.sku, 'RR1-10-WHT');
  assert.equal(createResponse.body.variant.stockQuantity, 8);
  assert.equal(createResponse.body.variant.discountPercent, 12.5);

  const updateResponse = await request(createApp())
    .patch(`/api/admin/variants/${createResponse.body.variant.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ color: 'Cream', stockQuantity: 6, discountPercent: 25 })
    .expect(200);

  assert.equal(updateResponse.body.variant.color, 'Cream');
  assert.equal(updateResponse.body.variant.stockQuantity, 6);
  assert.equal(updateResponse.body.variant.discountPercent, 25);

  await request(createApp())
    .post('/api/admin/products/999/variants')
    .set('Authorization', `Bearer ${token}`)
    .send({ sku: 'MISSING-10-WHT', size: '10', color: 'White', stockQuantity: 1, discountPercent: 0 })
    .expect(404);
});

test('rejects legacy priceDelta input when creating an admin variant', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .post('/api/admin/products/10/variants')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .send({ sku: 'RR1-LEGACY', size: '10', color: 'White', stockQuantity: 1, priceDelta: 5 })
    .expect(400);

  assert.deepEqual(response.body, {
    message: 'priceDelta is not supported; use discountPercent',
    details: null
  });
  assert.equal(variants.length, 1);
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
        discountPercent: 0
      })
      .expect(400);

    assert.deepEqual(response.body, { message: 'Stock quantity must be nonnegative', details: null });
  }
});

test('rejects invalid variant discount percentages with 400 JSON', async () => {
  const { createApp } = require('../src/app');
  const token = tokenFor(2);
  const invalidDiscounts = [null, '', '   ', [], {}, 'abc', -0.01, 100.01, false];

  for (const [index, discountPercent] of invalidDiscounts.entries()) {
    const response = await request(createApp())
      .post('/api/admin/products/10/variants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sku: `BAD-DISCOUNT-${index}`,
        size: '10',
        color: 'White',
        stockQuantity: 1,
        discountPercent
      })
      .expect(400);

    assert.deepEqual(response.body, { message: 'Discount percent must be between 0 and 100', details: null });
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

test('rejects fulfillment of a pending VNPay order without changing payment', async () => {
  const { createApp } = require('../src/app');
  const token = tokenFor(2);
  orders[0].payment_method = 'vnpay';
  orders[0].payment_status = 'pending';

  for (const status of ['confirmed', 'shipping']) {
    await request(createApp())
      .patch('/api/admin/orders/900/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status })
      .expect(status === 'confirmed' ? 200 : 409);
  }

  assert.equal(orders[0].order_status, 'confirmed');
  assert.equal(orders[0].payment_status, 'pending');
});

test('rejects fulfillment of a failed VNPay order without changing payment', async () => {
  const { createApp } = require('../src/app');
  const token = tokenFor(2);
  orders[0].payment_method = 'vnpay';
  orders[0].payment_status = 'failed';

  for (const status of ['confirmed', 'shipping']) {
    await request(createApp())
      .patch('/api/admin/orders/900/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status })
      .expect(status === 'confirmed' ? 200 : 409);
  }

  assert.equal(orders[0].order_status, 'confirmed');
  assert.equal(orders[0].payment_status, 'failed');
});

test('uses a separate typed parameter when deriving payment status from order status', async () => {
  const { createApp } = require('../src/app');
  const token = tokenFor(2);

  await request(createApp())
    .patch('/api/admin/orders/900/status')
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'confirmed' })
    .expect(200);

  const updateQuery = queryLog.find((entry) => entry.text.includes('UPDATE orders'));

  assert.match(updateQuery.text, /CASE WHEN \$3::order_status = 'completed'/);
  assert.match(updateQuery.text, /payment_method = 'cod'/);
  assert.deepEqual(updateQuery.params, ['confirmed', '900', 'confirmed']);
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

test('restores variant stock when admin cancels an order', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .patch('/api/admin/orders/900/status')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .send({ status: 'cancelled' })
    .expect(200);

  assert.equal(response.body.order.orderStatus, 'cancelled');
  assert.equal(response.body.order.paymentStatus, 'unpaid');
  assert.equal(variants[0].stock_quantity, 6);
  assert.deepEqual(restoredStockUpdates, [{ variantId: 101, quantity: 1 }]);
});

test('rejects cancelling a pending VNPay order without restoring stock', async () => {
  const { createApp } = require('../src/app');
  orders[0].payment_method = 'vnpay';
  orders[0].payment_status = 'pending';

  const response = await request(createApp())
    .patch('/api/admin/orders/900/status')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .send({ status: 'cancelled' })
    .expect(409);

  assert.match(response.body.message, /reconciled before cancellation/);
  assert.equal(orders[0].order_status, 'pending');
  assert.equal(orders[0].payment_status, 'pending');
  assert.equal(variants[0].stock_quantity, 5);
  assert.deepEqual(restoredStockUpdates, []);
});

test('rejects cancelling a paid VNPay order before restoring stock', async () => {
  const { createApp } = require('../src/app');
  orders[0].payment_method = 'vnpay';
  orders[0].payment_status = 'paid';

  const response = await request(createApp())
    .patch('/api/admin/orders/900/status')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .send({ status: 'cancelled' })
    .expect(409);

  assert.deepEqual(response.body, {
    message: 'Paid VNPay orders require a refund before cancellation',
    details: null
  });
  assert.equal(orders[0].order_status, 'pending');
  assert.equal(orders[0].payment_status, 'paid');
  assert.equal(variants[0].stock_quantity, 5);
  assert.deepEqual(restoredStockUpdates, []);
  assert.equal(queryLog.some((entry) => entry.text.includes('FROM order_items')), false);
  assert.equal(
    queryLog.some((entry) => entry.text.includes('stock_quantity = stock_quantity + $1')),
    false
  );
});

test('returns 400 JSON when admin status body is empty', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .patch('/api/admin/orders/900/status')
    .set('Authorization', `Bearer ${tokenFor(2)}`)
    .send()
    .expect(400);

  assert.deepEqual(response.body, { message: 'Invalid order status', details: null });
});
