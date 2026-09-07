const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

process.env.VNPAY_HOST = 'https://sandbox.vnpayment.vn';
process.env.VNPAY_TMN_CODE = 'SOLELY01';
process.env.VNPAY_SECURE_SECRET = 'test-secret-for-vnpay';
process.env.VNPAY_RETURN_URL = 'http://localhost:5000/api/payments/vnpay/return';
process.env.VNPAY_IPN_URL = 'https://payments.example.test/api/payments/vnpay/ipn';
process.env.VNPAY_TEST_MODE = 'false';
process.env.FRONTEND_URL = 'http://localhost:5173';

const { env } = require('../src/config/env');
const {
  buildVnpayResponse,
  createPaymentUrl,
  verifyPaymentParams
} = require('../src/modules/payments/vnpay.service');

const CALLBACK_SIGNATURE = '92b57a51e2df221c498a053d88f606d31883996204dd104c0282f2a61571f159894eb78db2eccaa61072e1a652b2f5b988e323aea4d55750b7a823371feeda5e';

function validCallbackParams() {
  return {
    vnp_TxnRef: 'ORD-20260907-ABC123',
    vnp_TransactionNo: '14587465',
    vnp_TmnCode: 'SOLELY01',
    vnp_ResponseCode: '00',
    vnp_OrderInfo: 'Thanh toan don hang SOLELY & Co',
    vnp_BankCode: 'NCB',
    vnp_Amount: '125050000',
    vnp_SecureHashType: 'HmacSHA512',
    vnp_SecureHash: CALLBACK_SIGNATURE
  };
}

test('parses VNPay and frontend environment values without exposing the secret', () => {
  assert.equal(env.VNPAY_HOST, 'https://sandbox.vnpayment.vn');
  assert.equal(env.VNPAY_TMN_CODE, 'SOLELY01');
  assert.equal(env.VNPAY_SECURE_SECRET, 'test-secret-for-vnpay');
  assert.equal(env.VNPAY_RETURN_URL, 'http://localhost:5000/api/payments/vnpay/return');
  assert.equal(env.VNPAY_IPN_URL, 'https://payments.example.test/api/payments/vnpay/ipn');
  assert.equal(env.VNPAY_TEST_MODE, false);
  assert.equal(env.FRONTEND_URL, 'http://localhost:5173');
});

test('creates a payment URL with sorted parameters encoded exactly once', () => {
  const paymentUrl = new URL(createPaymentUrl({
    orderId: 42,
    orderCode: 'SOLELY & Co',
    amount: 1250500,
    ipAddress: '203.0.113.9'
  }));
  const keysWithoutHash = [...paymentUrl.searchParams.keys()].filter((key) => key !== 'vnp_SecureHash');

  assert.equal(paymentUrl.origin, 'https://sandbox.vnpayment.vn');
  assert.equal(paymentUrl.pathname, '/paymentv2/vpcpay.html');
  assert.deepEqual(keysWithoutHash, [...keysWithoutHash].sort());
  assert.equal(paymentUrl.searchParams.get('vnp_TxnRef'), '42');
  assert.equal(paymentUrl.searchParams.get('vnp_OrderInfo'), 'Thanh toan don hang SOLELY & Co');
  assert.match(paymentUrl.search, /vnp_OrderInfo=Thanh\+toan\+don\+hang\+SOLELY\+%26\+Co/);
  assert.doesNotMatch(paymentUrl.search, /%2526/);
});

test('signs the exact sorted payment query with HMAC-SHA512', () => {
  const paymentUrl = new URL(createPaymentUrl({
    orderId: 42,
    orderCode: 'SOLELY & Co',
    amount: 1250500,
    ipAddress: '203.0.113.9'
  }));
  const signature = paymentUrl.searchParams.get('vnp_SecureHash');
  paymentUrl.searchParams.delete('vnp_SecureHash');
  const expectedSignature = crypto
    .createHmac('sha512', 'test-secret-for-vnpay')
    .update(paymentUrl.searchParams.toString(), 'utf8')
    .digest('hex');

  assert.equal(signature, expectedSignature);
  assert.match(signature, /^[a-f0-9]{128}$/);
});

test('converts the VND payment amount to VNPay minor units', () => {
  const paymentUrl = new URL(createPaymentUrl({
    orderId: 42,
    orderCode: 'ORD-42',
    amount: 1250500,
    ipAddress: '203.0.113.9'
  }));

  assert.equal(paymentUrl.searchParams.get('vnp_Amount'), '125050000');
});

test('verifies a signed callback and returns reconciliation fields without mutating input', () => {
  const params = validCallbackParams();
  const originalParams = { ...params };

  assert.deepEqual(verifyPaymentParams(params), {
    valid: true,
    responseCode: '00',
    transactionNo: '14587465',
    amount: 1250500
  });
  assert.deepEqual(params, originalParams);
});

test('rejects a callback with the wrong signature', () => {
  const params = {
    ...validCallbackParams(),
    vnp_SecureHash: '0'.repeat(128)
  };

  assert.deepEqual(verifyPaymentParams(params), {
    valid: false,
    responseCode: '00',
    transactionNo: '14587465',
    amount: 1250500
  });
});

test('rejects a callback whose amount was changed after signing', () => {
  const params = {
    ...validCallbackParams(),
    vnp_Amount: '125050001'
  };

  assert.deepEqual(verifyPaymentParams(params), {
    valid: false,
    responseCode: '00',
    transactionNo: '14587465',
    amount: 1250500.01
  });
});

test('rejects callbacks when the secure secret is not configured', () => {
  const configuredSecret = env.VNPAY_SECURE_SECRET;
  env.VNPAY_SECURE_SECRET = '';

  try {
    const params = {
      ...validCallbackParams(),
      vnp_SecureHash: 'cf68b4302ac02b0ce6ba8baba77054e956c259fdf65c129dd2c2b1b82769a35f8f4e3e6fa731d5e24db4fbf745c26888d64452a0ccb8e9c8b141237c6a7f4102'
    };

    assert.equal(verifyPaymentParams(params).valid, false);
  } finally {
    env.VNPAY_SECURE_SECRET = configuredSecret;
  }
});

test('builds the VNPay IPN response contract', () => {
  assert.deepEqual(buildVnpayResponse('00', 'Confirm Success'), {
    RspCode: '00',
    Message: 'Confirm Success'
  });
});
