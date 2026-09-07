const express = require('express');
const { env } = require('../../config/env');
const { reconcileVnpayPayment } = require('../orders/orders.service');
const { buildVnpayResponse, verifyPaymentParams } = require('./vnpay.service');

const router = express.Router();

router.get('/vnpay/return', (req, res) => {
  const verification = verifyPaymentParams(req.query);
  const redirectUrl = new URL('/payment-result', env.FRONTEND_URL);

  if (!verification.valid) {
    redirectUrl.searchParams.set('status', 'invalid');
    return res.redirect(redirectUrl.toString());
  }

  redirectUrl.searchParams.set('status', verification.responseCode === '00' ? 'success' : 'failed');
  redirectUrl.searchParams.set('orderId', String(req.query.vnp_TxnRef || ''));
  if (verification.responseCode !== null) {
    redirectUrl.searchParams.set('responseCode', verification.responseCode);
  }

  return res.redirect(redirectUrl.toString());
});

router.get('/vnpay/ipn', async (req, res) => {
  const verification = verifyPaymentParams(req.query);
  if (!verification.valid) {
    return res.json(buildVnpayResponse('97', 'Invalid Signature'));
  }

  try {
    const result = await reconcileVnpayPayment({
      orderId: req.query.vnp_TxnRef,
      amount: verification.amount,
      responseCode: verification.responseCode,
      transactionNo: verification.transactionNo
    });
    return res.json(buildVnpayResponse(result.code, result.message));
  } catch (error) {
    console.error('VNPay IPN reconciliation failed', { message: error.message });
    return res.json(buildVnpayResponse('99', 'Unknown error'));
  }
});

module.exports = router;
