const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { PGlite } = require('@electric-sql/pglite');

process.env.DATABASE_URL = '';
process.env.GEMINI_API_KEY = '';
process.env.OPENAI_API_KEY = '';
process.env.VNPAY_HOST = 'https://sandbox.vnpayment.vn';
process.env.JWT_SECRET = 'hardening-test-jwt';
process.env.VNPAY_TMN_CODE = 'SOLELY01';
process.env.VNPAY_SECURE_SECRET = 'hardening-test-secret';
process.env.VNPAY_RETURN_URL = 'https://example.test/api/payments/vnpay/return';
process.env.VNPAY_IPN_URL = 'https://example.test/api/payments/vnpay/ipn';

const root = path.resolve(__dirname, '../..');
const schema = fs.readFileSync(path.join(root, 'database/schema.sql'), 'utf8')
  .replace(/CREATE EXTENSION IF NOT EXISTS vector;\s*/i, '')
  .replace(/embedding vector\(768\)/i, 'embedding TEXT')
  .replace(/CREATE INDEX rag_chunks_embedding_idx[^;]+;/i, '');
const seed = fs.readFileSync(path.join(root, 'database/seed.sql'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'database/migrations/20260907-vnpay-discount.sql'), 'utf8');
const catalogMigration = fs.readFileSync(path.join(root, 'database/migrations/20260907-product-catalog-admin.sql'), 'utf8');
const db = new PGlite();
const dbModule = require('../src/db/pool');
async function query(sql, params) {
  const result = await db.query(sql, params);
  return { ...result, rowCount: result.rows.length || result.affectedRows || 0 };
}
// Keep services, routes, authentication and SQL real; replace only the DB connection.
dbModule.query = query;
dbModule.pool.query = query;
dbModule.pool.connect = async () => ({ query, release() {} });
const app = require('../src/app').createApp();
const auth = (id) => `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: String(id) })}`;
let customerId;
let adminId;
let otherId;
let variantId;
let productId;
let slug;

test.beforeEach(async () => {
  await db.exec(schema);
  await db.exec(seed);
  const users = (await query('SELECT id, role FROM users ORDER BY id')).rows;
  customerId = users.find((u) => u.role === 'customer').id;
  adminId = users.find((u) => u.role === 'admin').id;
  otherId = (await query(`INSERT INTO users (email, password_hash, first_name, last_name, role)
    VALUES ('other@test.invalid', 'unused', 'Other', 'Customer', 'customer') RETURNING id`)).rows[0].id;
  const variant = (await query(`SELECT pv.id, pv.product_id, p.slug FROM product_variants pv
    JOIN products p ON p.id = pv.product_id ORDER BY pv.id LIMIT 1`)).rows[0];
  variantId = variant.id;
  productId = variant.product_id;
  slug = variant.slug;
  await query('UPDATE products SET base_price = 101 WHERE id = $1', [productId]);
  await query('UPDATE product_variants SET stock_quantity = 20, discount_percent = 50 WHERE id = $1', [variantId]);
});
test.after(() => db.close());

async function checkout(paymentMethod = 'vnpay') {
  await request(app).post('/api/cart/items').set('Authorization', auth(customerId))
    .send({ variantId, quantity: 3 }).expect(201);
  const response = await request(app).post('/api/orders').set('Authorization', auth(customerId))
    .send({ paymentMethod, receiverName: 'Test Customer', phone: '0900000000',
      shippingAddress: { line1: '1 Test', city: 'Hanoi', state: 'Hanoi', postalCode: '100000', country: 'VN' } }).expect(201);
  return response.body;
}
function changeStatus(id, status) {
  return request(app).patch(`/api/admin/orders/${id}/status`).set('Authorization', auth(adminId)).send({ status });
}
function ipn(order, success = true) {
  const params = { vnp_TxnRef: String(order.id), vnp_Amount: String(order.grandTotal * 100),
    vnp_TmnCode: 'SOLELY01', vnp_TransactionNo: '12345', vnp_ResponseCode: success ? '00' : '24',
    vnp_TransactionStatus: success ? '00' : '02' };
  const payload = new URLSearchParams(Object.entries(params).sort(([a], [b]) => a.localeCompare(b))).toString();
  params.vnp_SecureHash = crypto.createHmac('sha512', process.env.VNPAY_SECURE_SECRET).update(payload).digest('hex');
  return request(app).get('/api/payments/vnpay/ipn').query(params);
}
async function stock() {
  return Number((await query('SELECT stock_quantity FROM product_variants WHERE id = $1', [variantId])).rows[0].stock_quantity);
}

test('fresh schema defaults to explicit pricing and stores nullable historical item context', async () => {
  const row = (await query('SELECT * FROM product_variants WHERE id = $1', [variantId])).rows[0];
  assert.equal(row.legacy_pricing_active, false);
  assert.equal(row.legacy_price_delta, null);
  const columns = (await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'order_items'")).rows.map((r) => r.column_name);
  assert.ok(columns.includes('base_price'));
  assert.ok(columns.includes('discount_percent'));
});

test('catalog SQL filtering, detail, cart and order snapshots agree on whole-dong unit rounding', async () => {
  const catalog = await request(app).get('/api/products').query({ minPrice: 51, maxPrice: 51 }).expect(200);
  assert.ok(catalog.body.products.some((p) => p.id === Number(productId) && p.price === 51));
  const detail = await request(app).get(`/api/products/${slug}`).expect(200);
  assert.equal(detail.body.product.variants.find((v) => v.id === Number(variantId)).unitPrice, 51);
  await request(app).post('/api/cart/items').set('Authorization', auth(customerId)).send({ variantId, quantity: 3 }).expect(201);
  const cart = (await request(app).get('/api/cart').set('Authorization', auth(customerId)).expect(200)).body.cart;
  assert.equal(cart.items[0].basePrice, 101);
  assert.equal(cart.items[0].discountPercent, 50);
  assert.equal(cart.items[0].unitPrice, 51);
  assert.equal(cart.items[0].lineTotal, 153);
  assert.equal(cart.subtotal, 153);
});

test('order and admin item context remains a historical snapshot after product repricing', async () => {
  const { order } = await checkout();
  assert.equal(order.grandTotal, 153);
  assert.equal(order.items[0].basePrice, 101);
  assert.equal(order.items[0].discountPercent, 50);
  assert.equal(order.items[0].unitPrice, 51);
  assert.equal(order.items[0].lineTotal, 153);
  await query('UPDATE products SET base_price = 900 WHERE id = $1', [productId]);
  await query('UPDATE product_variants SET discount_percent = 0 WHERE id = $1', [variantId]);
  for (const [url, userId] of [[`/api/orders/${order.id}`, customerId], [`/api/admin/orders/${order.id}`, adminId]]) {
    const found = (await request(app).get(url).set('Authorization', auth(userId)).expect(200)).body.order;
    assert.deepEqual(found.items, order.items);
  }
  const item = (await query('SELECT * FROM order_items WHERE order_id = $1', [order.id])).rows[0];
  assert.equal(Number(item.unit_price), 51);
  assert.equal(Number(item.line_total), 153);
});

test('migration applied twice preserves legacy audit delta and explicit zero retires fallback permanently', async () => {
  const historical = (await checkout('cod')).order;
  await db.exec(`ALTER TABLE product_variants DROP COLUMN IF EXISTS legacy_pricing_active;
    ALTER TABLE product_variants DROP COLUMN IF EXISTS legacy_price_delta;
    ALTER TABLE product_variants RENAME COLUMN discount_percent TO price_delta;
    ALTER TABLE order_items DROP COLUMN IF EXISTS base_price;
    ALTER TABLE order_items DROP COLUMN IF EXISTS discount_percent;`);
  await query('UPDATE product_variants SET price_delta = 25 WHERE id = $1', [variantId]);
  await db.exec(catalogMigration);
  await db.exec(migration);
  await db.exec(catalogMigration);
  await db.exec(migration);
  const preserved = (await request(app).get(`/api/orders/${historical.id}`).set('Authorization', auth(customerId)).expect(200)).body.order;
  assert.equal(preserved.grandTotal, 153);
  assert.equal(preserved.items[0].unitPrice, 51);
  assert.equal(preserved.items[0].basePrice, null);
  assert.equal(preserved.items[0].discountPercent, null);
  const getPrice = async () => (await request(app).get(`/api/products/${slug}`).expect(200)).body.product.variants.find((v) => v.id === Number(variantId)).unitPrice;
  assert.equal(await getPrice(), 126);
  await request(app).patch(`/api/admin/variants/${variantId}`).set('Authorization', auth(adminId)).send({ stockQuantity: 19 }).expect(200);
  assert.equal(await getPrice(), 126);
  await request(app).patch(`/api/admin/variants/${variantId}`).set('Authorization', auth(adminId)).send({ discountPercent: 0 }).expect(200);
  assert.equal(await getPrice(), 101);
  await db.exec(migration);
  assert.equal(await getPrice(), 101);
  const row = (await query('SELECT * FROM product_variants WHERE id = $1', [variantId])).rows[0];
  assert.equal(Number(row.legacy_price_delta), 25);
  assert.equal(row.legacy_pricing_active, false);
  const catalog = await request(app).get('/api/products').query({ minPrice: 101, maxPrice: 101 }).expect(200);
  assert.ok(catalog.body.products.some((p) => p.id === Number(productId) && p.price === 101));
  // A nonzero explicit discount followed by zero must also keep audit pricing retired.
  await request(app).patch(`/api/admin/variants/${variantId}`).set('Authorization', auth(adminId)).send({ discountPercent: 10 }).expect(200);
  assert.equal(await getPrice(), 91);
  await request(app).patch(`/api/admin/variants/${variantId}`).set('Authorization', auth(adminId)).send({ discountPercent: 0 }).expect(200);
  assert.equal(await getPrice(), 101);
});

test('both additive migrations upgrade old payment enums and can run again without losing data', async () => {
  await db.exec(schema.replace("CREATE TYPE payment_method AS ENUM ('cod', 'vnpay');", "CREATE TYPE payment_method AS ENUM ('cod');")
    .replace("CREATE TYPE payment_status AS ENUM ('unpaid', 'pending', 'paid', 'failed');", "CREATE TYPE payment_status AS ENUM ('unpaid', 'paid');"));
  await db.exec(seed);
  for (let pass = 0; pass < 2; pass += 1) {
    await db.exec(catalogMigration);
    await db.exec(migration);
  }
  const labels = (await query(`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname IN ('payment_method', 'payment_status') ORDER BY e.enumlabel`)).rows.map((r) => r.enumlabel);
  assert.deepEqual(labels, ['cod', 'failed', 'paid', 'pending', 'unpaid', 'vnpay']);
  assert.ok((await query('SELECT id FROM products')).rowCount >= 20);
});

test('admin form stock payload preserves legacy pricing; explicitly included zero retires it', async () => {
  await query('UPDATE product_variants SET discount_percent = 0, legacy_price_delta = 25, legacy_pricing_active = TRUE WHERE id = $1', [variantId]);
  const original = (await request(app).get(`/api/admin/products/${productId}`).set('Authorization', auth(adminId)).expect(200))
    .body.product.variants.find((v) => v.id === Number(variantId));
  const payload = { sku: original.sku, size: original.size, color: original.color, stockQuantity: 19 };
  await request(app).patch(`/api/admin/variants/${variantId}`).set('Authorization', auth(adminId)).send(payload).expect(200);
  let row = (await query('SELECT * FROM product_variants WHERE id = $1', [variantId])).rows[0];
  assert.equal(row.legacy_pricing_active, true);
  assert.equal(Number(row.stock_quantity), 19);
  const getPrice = async () => (await request(app).get(`/api/products/${slug}`).expect(200)).body.product.variants.find((v) => v.id === Number(variantId)).unitPrice;
  assert.equal(await getPrice(), 126);
  await request(app).patch(`/api/admin/variants/${variantId}`).set('Authorization', auth(adminId)).send({ ...payload, discountPercent: 0 }).expect(200);
  row = (await query('SELECT * FROM product_variants WHERE id = $1', [variantId])).rows[0];
  assert.equal(row.legacy_pricing_active, false);
  assert.equal(Number(row.legacy_price_delta), 25);
  assert.equal(await getPrice(), 101);
});

for (const paymentStatus of ['pending', 'failed']) {
  for (const [from, to] of [['confirmed', 'shipping'], ['shipping', 'completed']]) {
    test(`VNPay ${paymentStatus} cannot move from ${from} to ${to}`, async () => {
      const { order } = await checkout();
      await query('UPDATE orders SET payment_status = $1, order_status = $2 WHERE id = $3', [paymentStatus, from, order.id]);
      await changeStatus(order.id, to).expect(409);
      const row = (await query('SELECT * FROM orders WHERE id = $1', [order.id])).rows[0];
      assert.equal(row.order_status, from);
      assert.equal(row.payment_status, paymentStatus);
      assert.equal(await stock(), 17);
    });
  }
}

for (const callbackFirst of [false, true]) {
  test(`cancellation/IPN race keeps reserved stock and paid order when callback runs ${callbackFirst ? 'first' : 'last'}`, async () => {
    const { order } = await checkout();
    if (callbackFirst) assert.equal((await ipn(order)).body.RspCode, '00');
    await changeStatus(order.id, 'cancelled').expect(409);
    if (!callbackFirst) assert.equal((await ipn(order)).body.RspCode, '00');
    assert.equal((await ipn(order)).body.RspCode, '00');
    const row = (await query('SELECT * FROM orders WHERE id = $1', [order.id])).rows[0];
    assert.equal(row.order_status, 'pending');
    assert.equal(row.payment_status, 'paid');
    assert.equal(await stock(), 17);
  });
}

test('failed VNPay cancellation restores stock once; COD can ship and complete unpaid', async () => {
  const { order } = await checkout();
  assert.equal((await ipn(order, false)).body.RspCode, '00');
  await changeStatus(order.id, 'cancelled').expect(200);
  await changeStatus(order.id, 'cancelled').expect(400);
  assert.equal(await stock(), 20);
  const cod = (await checkout('cod')).order;
  await changeStatus(cod.id, 'confirmed').expect(200);
  await changeStatus(cod.id, 'shipping').expect(200);
  const complete = await changeStatus(cod.id, 'completed').expect(200);
  assert.equal(complete.body.order.paymentStatus, 'paid');
});

test('owned pending VNPay retry signs current URL for stored amount without changing order, stock or new cart', async (t) => {
  const { order, paymentUrl } = await checkout();
  await request(app).post('/api/cart/items').set('Authorization', auth(customerId)).send({ variantId, quantity: 1 }).expect(201);
  const before = (await query('SELECT * FROM orders ORDER BY id')).rows;
  const cartBefore = (await query('SELECT * FROM cart_items ORDER BY id')).rows;
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2027-01-01T00:00:00Z') });
  const response = await request(app).post(`/api/orders/${order.id}/payment-url`).set('Authorization', auth(customerId))
    .send({ amount: 1, userId: otherId }).expect(200);
  const url = new URL(response.body.paymentUrl);
  assert.notEqual(response.body.paymentUrl, paymentUrl);
  assert.equal(url.searchParams.get('vnp_TxnRef'), String(order.id));
  assert.equal(url.searchParams.get('vnp_Amount'), '15300');
  assert.equal(url.searchParams.get('vnp_CreateDate'), '20270101070000');
  const signature = url.searchParams.get('vnp_SecureHash');
  url.searchParams.delete('vnp_SecureHash');
  assert.equal(signature, crypto.createHmac('sha512', process.env.VNPAY_SECURE_SECRET).update(url.search.slice(1)).digest('hex'));
  assert.deepEqual((await query('SELECT * FROM orders ORDER BY id')).rows, before);
  assert.deepEqual((await query('SELECT * FROM cart_items ORDER BY id')).rows, cartBefore);
  assert.equal(await stock(), 17);
});

test('confirmed pending payment can resume and paid VNPay can finish fulfillment', async () => {
  const { order } = await checkout();
  await changeStatus(order.id, 'confirmed').expect(200);
  await request(app).post(`/api/orders/${order.id}/payment-url`).set('Authorization', auth(customerId)).expect(200);
  assert.equal((await ipn(order)).body.RspCode, '00');
  await changeStatus(order.id, 'shipping').expect(200);
  const completed = await changeStatus(order.id, 'completed').expect(200);
  assert.equal(completed.body.order.paymentStatus, 'paid');
  await request(app).post(`/api/orders/${order.id}/payment-url`).set('Authorization', auth(customerId)).expect(409);
  assert.equal(await stock(), 17);
});

test('retry enforces authentication, customer role, ownership, valid id and existence', async () => {
  const { order } = await checkout();
  const url = `/api/orders/${order.id}/payment-url`;
  await request(app).post(url).expect(401);
  await request(app).post(url).set('Authorization', auth(adminId)).expect(403);
  await request(app).post(url).set('Authorization', auth(otherId)).expect(404);
  await request(app).post('/api/orders/999999/payment-url').set('Authorization', auth(customerId)).expect(404);
  await request(app).post('/api/orders/invalid/payment-url').set('Authorization', auth(customerId)).expect(400);
});

test('retry rejects COD, paid, failed, cancelled and fulfilled orders', async () => {
  const { order } = await checkout();
  for (const [method, payment, status] of [['cod', 'unpaid', 'pending'], ['vnpay', 'paid', 'pending'],
    ['vnpay', 'failed', 'pending'], ['vnpay', 'pending', 'cancelled'], ['vnpay', 'pending', 'shipping'], ['vnpay', 'pending', 'completed']]) {
    await query('UPDATE orders SET payment_method = $1, payment_status = $2, order_status = $3 WHERE id = $4', [method, payment, status, order.id]);
    await request(app).post(`/api/orders/${order.id}/payment-url`).set('Authorization', auth(customerId)).expect(409);
  }
  assert.equal(await stock(), 17);
});
