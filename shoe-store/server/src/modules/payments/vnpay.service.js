const crypto = require('node:crypto');
const { env } = require('../../config/env');

const PAYMENT_PATH = '/paymentv2/vpcpay.html';
const SIGNATURE_FIELDS = new Set(['vnp_SecureHash', 'vnp_SecureHashType']);

function compareKeys([left], [right]) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function buildSignedPayload(params) {
  const entries = Object.entries(params)
    .filter(([key, value]) => !SIGNATURE_FIELDS.has(key) && value !== null && value !== undefined)
    .sort(compareKeys)
    .map(([key, value]) => [key, String(value)]);

  return new URLSearchParams(entries).toString();
}

function sign(payload) {
  return crypto
    .createHmac('sha512', env.VNPAY_SECURE_SECRET)
    .update(payload, 'utf8')
    .digest('hex');
}

function formatVnpayDate(date = new Date()) {
  const vietnamTime = new Date(date.getTime() + (7 * 60 * 60 * 1000));
  return vietnamTime.toISOString().slice(0, 19).replace(/[-T:]/g, '');
}

function requirePaymentConfig() {
  if (
    !env.VNPAY_HOST
    || !env.VNPAY_TMN_CODE
    || !env.VNPAY_SECURE_SECRET
    || !env.VNPAY_RETURN_URL
    || !env.VNPAY_IPN_URL
  ) {
    throw new Error('VNPay configuration is incomplete');
  }
}

function toMinorUnits(amount) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('VNPay amount must be a positive number');
  }

  return Math.round((numericAmount + Number.EPSILON) * 100);
}

function createPaymentUrl({ orderId, orderCode, amount, ipAddress }) {
  requirePaymentConfig();
  const createdAt = new Date();

  const params = {
    vnp_Amount: toMinorUnits(amount),
    vnp_Command: 'pay',
    vnp_CreateDate: formatVnpayDate(createdAt),
    vnp_ExpireDate: formatVnpayDate(new Date(createdAt.getTime() + 15 * 60 * 1000)),
    vnp_CurrCode: 'VND',
    vnp_IpAddr: String(ipAddress || ''),
    vnp_Locale: 'vn',
    vnp_OrderInfo: `Thanh toan don hang ${String(orderCode || '')}`,
    vnp_OrderType: 'other',
    vnp_ReturnUrl: env.VNPAY_RETURN_URL,
    vnp_TmnCode: env.VNPAY_TMN_CODE,
    vnp_TxnRef: String(orderId),
    vnp_Version: '2.1.0'
  };
  const payload = buildSignedPayload(params);
  const paymentUrl = new URL(env.VNPAY_HOST);

  if (paymentUrl.pathname === '/' || paymentUrl.pathname === '') {
    paymentUrl.pathname = PAYMENT_PATH;
  }
  paymentUrl.search = `${payload}&vnp_SecureHash=${sign(payload)}`;

  return paymentUrl.toString();
}

function signaturesMatch(receivedSignature, expectedSignature) {
  if (!/^[a-fA-F0-9]{128}$/.test(receivedSignature)) {
    return false;
  }

  const receivedBuffer = Buffer.from(receivedSignature.toLowerCase(), 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

function verifyPaymentParams(params = {}) {
  const receivedSignature = String(params.vnp_SecureHash || '');
  const payload = buildSignedPayload(params);
  const minorAmount = Number(params.vnp_Amount);
  const validAmount = Number.isSafeInteger(minorAmount) && minorAmount > 0;
  const signatureValid = Boolean(env.VNPAY_SECURE_SECRET)
    && signaturesMatch(receivedSignature, sign(payload));
  const responseCode = params.vnp_ResponseCode === undefined
    ? null
    : String(params.vnp_ResponseCode).trim() || null;
  const transactionStatus = params.vnp_TransactionStatus === undefined
    ? null
    : String(params.vnp_TransactionStatus).trim() || null;
  const transactionNo = params.vnp_TransactionNo === undefined
    ? null
    : String(params.vnp_TransactionNo).trim() || null;
  const txnRef = params.vnp_TxnRef === undefined
    ? null
    : String(params.vnp_TxnRef).trim() || null;
  const requiredFieldsPresent = Boolean(responseCode && transactionStatus && transactionNo && txnRef);

  return {
    valid: validAmount && signatureValid && requiredFieldsPresent,
    signatureValid,
    requiredFieldsPresent,
    responseCode,
    transactionStatus,
    transactionNo,
    txnRef,
    amount: validAmount ? minorAmount / 100 : null
  };
}

function buildVnpayResponse(code, message) {
  return {
    RspCode: String(code),
    Message: String(message)
  };
}

module.exports = {
  buildVnpayResponse,
  createPaymentUrl,
  verifyPaymentParams
};
