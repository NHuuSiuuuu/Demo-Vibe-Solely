const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const Module = require('node:module');
const request = require('supertest');

const originalLoad = Module._load;

process.env.VNPAY_HOST = 'https://sandbox.vnpayment.vn';
process.env.VNPAY_TMN_CODE = 'SOLELY01';
process.env.VNPAY_SECURE_SECRET = 'test-secret-for-vnpay';
process.env.VNPAY_RETURN_URL = 'http://localhost:5000/api/payments/vnpay/return';
process.env.VNPAY_IPN_URL = 'https://payments.example.test/api/payments/vnpay/ipn';
process.env.FRONTEND_URL = 'http://localhost:5173';

let order;
let transactionBegins;
let transactionCommits;
let orderLockCount;
let paymentUpdateCount;
let stockUpdateCount;
let cartClearCount;

function resetStore() {
  order = {
    id: 42,
    order_code: 'ORD-20260907-ABC123',
    user_id: 1,
    customer_email: 'customer@example.com',
    customer_name: 'Jordan Miles',
    shipping_address_line1: '1 Main St',
    shipping_address_line2: null,
    shipping_city: 'Austin',
    shipping_state: 'TX',
    shipping_postal_code: '78701',
    shipping_country: 'US',
    subtotal: '161.98',
    shipping_total: '0.00',
    tax_total: '0.00',
    grand_total: '161.98',
    note: null,
    order_status: 'pending',
    payment_method: 'vnpay',
    payment_status: 'pending',
    vnpay_transaction_no: null,
    vnpay_amount: null,
    vnpay_updated_at: null,
    created_at: '2026-09-07T00:00:00.000Z'
  };
  transactionBegins = 0;
  transactionCommits = 0;
  orderLockCount = 0;
  paymentUpdateCount = 0;
  stockUpdateCount = 0;
  cartClearCount = 0;
}

async function mockQuery(text, params = []) {
  if (text === 'BEGIN') {
    transactionBegins += 1;
    return { rows: [], rowCount: 0 };
  }

  if (text === 'COMMIT') {
    transactionCommits += 1;
    return { rows: [], rowCount: 0 };
  }

  if (text === 'ROLLBACK') {
    return { rows: [], rowCount: 0 };
  }

  if (text.includes('FROM orders') && text.includes('payment_method') && text.includes('FOR UPDATE')) {
    orderLockCount += 1;
    const found = order && String(order.id) === String(params[0]) ? { ...order } : null;
    return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
  }

  if (text.includes('UPDATE orders') && text.includes('vnpay_transaction_no')) {
    paymentUpdateCount += 1;
    order.payment_status = params[0];
    order.vnpay_transaction_no = params[1];
    order.vnpay_amount = params[2];
    order.vnpay_updated_at = '2026-09-07T01:00:00.000Z';
    return { rows: [{ ...order }], rowCount: 1 };
  }

  if (text.includes('UPDATE product_variants')) {
    stockUpdateCount += 1;
    return { rows: [], rowCount: 0 };
  }

  if (text.includes('DELETE FROM cart_items')) {
    cartClearCount += 1;
    return { rows: [], rowCount: 0 };
  }

  throw new Error(`Unexpected SQL in payments test: ${text}`);
}

Module._load = function patchedLoad(requestPath, parent, isMain) {
  const isTransactionPoolImport = requestPath === './pool'
    && parent?.filename.endsWith('/src/db/transactions.js');
  if (requestPath === '../../db/pool' || requestPath.endsWith('/db/pool') || isTransactionPoolImport) {
    return {
      query: mockQuery,
      pool: {
        connect: async () => ({ query: mockQuery, release() {} })
      }
    };
  }

  return originalLoad.call(this, requestPath, parent, isMain);
};

function signCallback(params) {
  const payload = new URLSearchParams(
    Object.entries(params)
      .filter(([key]) => key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, String(value)])
  ).toString();

  return crypto
    .createHmac('sha512', process.env.VNPAY_SECURE_SECRET)
    .update(payload, 'utf8')
    .digest('hex');
}

function callbackParams(overrides = {}) {
  const params = {
    vnp_TxnRef: '42',
    vnp_TransactionNo: '14587465',
    vnp_TmnCode: 'SOLELY01',
    vnp_ResponseCode: '00',
    vnp_TransactionStatus: '00',
    vnp_OrderInfo: 'Thanh toan don hang ORD-20260907-ABC123',
    vnp_BankCode: 'NCB',
    vnp_Amount: '16198',
    ...overrides
  };

  return { ...params, vnp_SecureHash: signCallback(params) };
}

test.after(() => {
  Module._load = originalLoad;
});

test.beforeEach(() => {
  resetStore();
});

test('successful VNPay IPN locks and marks one pending order paid', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .get('/api/payments/vnpay/ipn')
    .query(callbackParams())
    .expect(200);

  assert.deepEqual(response.body, { RspCode: '00', Message: 'Confirm Success' });
  assert.equal(order.payment_status, 'paid');
  assert.equal(order.vnpay_transaction_no, '14587465');
  assert.equal(Number(order.vnpay_amount), 161.98);
  assert.equal(transactionBegins, 1);
  assert.equal(transactionCommits, 1);
  assert.equal(orderLockCount, 1);
  assert.equal(paymentUpdateCount, 1);
});

test('failed VNPay IPN marks the pending order failed', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .get('/api/payments/vnpay/ipn')
    .query(callbackParams({ vnp_ResponseCode: '24', vnp_TransactionStatus: '02' }))
    .expect(200);

  assert.deepEqual(response.body, { RspCode: '00', Message: 'Confirm Success' });
  assert.equal(order.payment_status, 'failed');
  assert.equal(order.vnpay_transaction_no, '14587465');
  assert.equal(paymentUpdateCount, 1);
});

test('VNPay IPN does not mark paid when response succeeds but transaction status fails', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .get('/api/payments/vnpay/ipn')
    .query(callbackParams({ vnp_TransactionStatus: '02' }))
    .expect(200);

  assert.deepEqual(response.body, { RspCode: '00', Message: 'Confirm Success' });
  assert.equal(order.payment_status, 'failed');
  assert.equal(paymentUpdateCount, 1);
});

test('VNPay IPN rejects a signed callback missing response code without mutating the order', async () => {
  const { createApp } = require('../src/app');
  const params = callbackParams();
  delete params.vnp_ResponseCode;
  params.vnp_SecureHash = signCallback(params);

  const response = await request(createApp())
    .get('/api/payments/vnpay/ipn')
    .query(params)
    .expect(200);

  assert.deepEqual(response.body, { RspCode: '99', Message: 'Invalid callback' });
  assert.equal(order.payment_status, 'pending');
  assert.equal(transactionBegins, 0);
  assert.equal(paymentUpdateCount, 0);
});

test('VNPay IPN rejects a signed callback missing transaction status without mutating the order', async () => {
  const { createApp } = require('../src/app');
  const params = callbackParams();
  delete params.vnp_TransactionStatus;
  params.vnp_SecureHash = signCallback(params);

  const response = await request(createApp())
    .get('/api/payments/vnpay/ipn')
    .query(params)
    .expect(200);

  assert.deepEqual(response.body, { RspCode: '99', Message: 'Invalid callback' });
  assert.equal(order.payment_status, 'pending');
  assert.equal(transactionBegins, 0);
  assert.equal(paymentUpdateCount, 0);
});

test('VNPay IPN rejects an invalid signature before starting a transaction', async () => {
  const { createApp } = require('../src/app');
  const params = callbackParams();
  params.vnp_SecureHash = '0'.repeat(128);

  const response = await request(createApp())
    .get('/api/payments/vnpay/ipn')
    .query(params)
    .expect(200);

  assert.deepEqual(response.body, { RspCode: '97', Message: 'Invalid Signature' });
  assert.equal(order.payment_status, 'pending');
  assert.equal(transactionBegins, 0);
  assert.equal(orderLockCount, 0);
  assert.equal(paymentUpdateCount, 0);
});

test('VNPay IPN rejects an amount that differs from the locked order total', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .get('/api/payments/vnpay/ipn')
    .query(callbackParams({ vnp_Amount: '99900' }))
    .expect(200);

  assert.deepEqual(response.body, { RspCode: '04', Message: 'Invalid Amount' });
  assert.equal(order.payment_status, 'pending');
  assert.equal(orderLockCount, 1);
  assert.equal(paymentUpdateCount, 0);
});

test('VNPay IPN reports an unknown order without updating another order', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .get('/api/payments/vnpay/ipn')
    .query(callbackParams({ vnp_TxnRef: '999' }))
    .expect(200);

  assert.deepEqual(response.body, { RspCode: '01', Message: 'Order not found' });
  assert.equal(order.payment_status, 'pending');
  assert.equal(paymentUpdateCount, 0);
});

test('repeated successful VNPay IPN is idempotent and never touches stock or cart', async () => {
  const { createApp } = require('../src/app');
  const app = createApp();
  const params = callbackParams();

  const firstResponse = await request(app)
    .get('/api/payments/vnpay/ipn')
    .query(params)
    .expect(200);
  const retryResponse = await request(app)
    .get('/api/payments/vnpay/ipn')
    .query(params)
    .expect(200);

  assert.deepEqual(firstResponse.body, { RspCode: '00', Message: 'Confirm Success' });
  assert.deepEqual(retryResponse.body, { RspCode: '00', Message: 'Confirm Success' });
  assert.equal(order.payment_status, 'paid');
  assert.equal(transactionBegins, 2);
  assert.equal(transactionCommits, 2);
  assert.equal(orderLockCount, 2);
  assert.equal(paymentUpdateCount, 1);
  assert.equal(stockUpdateCount, 0);
  assert.equal(cartClearCount, 0);
});

test('VNPay IPN cannot change a cancelled order payment state', async () => {
  const { createApp } = require('../src/app');
  order.order_status = 'cancelled';
  order.payment_status = 'pending';

  const response = await request(createApp())
    .get('/api/payments/vnpay/ipn')
    .query(callbackParams())
    .expect(200);

  assert.deepEqual(response.body, { RspCode: '02', Message: 'Order already confirmed' });
  assert.equal(order.order_status, 'cancelled');
  assert.equal(order.payment_status, 'pending');
  assert.equal(paymentUpdateCount, 0);
  assert.equal(stockUpdateCount, 0);
  assert.equal(cartClearCount, 0);
});

test('signed VNPay return redirects to a non-authoritative frontend result', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .get('/api/payments/vnpay/return')
    .query(callbackParams())
    .expect(302);

  const redirect = new URL(response.headers.location);
  assert.equal(redirect.origin, 'http://localhost:5173');
  assert.equal(redirect.pathname, '/payment-result');
  assert.equal(redirect.searchParams.get('status'), 'success');
  assert.equal(redirect.searchParams.get('orderId'), '42');
  assert.equal(redirect.searchParams.get('responseCode'), '00');
  assert.equal(paymentUpdateCount, 0);
});

test('VNPay return reports failure when transaction status is not successful', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .get('/api/payments/vnpay/return')
    .query(callbackParams({ vnp_TransactionStatus: '02' }))
    .expect(302);

  const redirect = new URL(response.headers.location);
  assert.equal(redirect.searchParams.get('status'), 'failed');
  assert.equal(paymentUpdateCount, 0);
});

test('VNPay return reports invalid when a signed callback misses transaction status', async () => {
  const { createApp } = require('../src/app');
  const params = callbackParams();
  delete params.vnp_TransactionStatus;
  params.vnp_SecureHash = signCallback(params);

  const response = await request(createApp())
    .get('/api/payments/vnpay/return')
    .query(params)
    .expect(302);

  const redirect = new URL(response.headers.location);
  assert.equal(redirect.searchParams.get('status'), 'invalid');
  assert.equal(redirect.searchParams.has('orderId'), false);
  assert.equal(paymentUpdateCount, 0);
});

test('VNPay return labels an invalid signature without updating the order', async () => {
  const { createApp } = require('../src/app');
  const params = callbackParams();
  params.vnp_SecureHash = '0'.repeat(128);

  const response = await request(createApp())
    .get('/api/payments/vnpay/return')
    .query(params)
    .expect(302);

  const redirect = new URL(response.headers.location);
  assert.equal(redirect.searchParams.get('status'), 'invalid');
  assert.equal(redirect.searchParams.has('orderId'), false);
  assert.equal(paymentUpdateCount, 0);
});
