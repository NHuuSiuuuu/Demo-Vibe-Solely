const express = require('express');
const { env } = require('../../config/env');
const { reconcileVnpayPayment } = require('../orders/orders.service');
const { buildVnpayResponse, verifyPaymentParams } = require('./vnpay.service');

const router = express.Router();

router.get('/vnpay/return', async (req, res) => {
  const verification = verifyPaymentParams(req.query);
  const redirectUrl = new URL('/payment-result', env.FRONTEND_URL);

  if (!verification.valid) {
    redirectUrl.searchParams.set('status', 'invalid');
    return res.redirect(redirectUrl.toString());
  }

  const successful = verification.responseCode === '00' && verification.transactionStatus === '00';
  try {
    await reconcileVnpayPayment({
      orderId: verification.txnRef,
      amount: verification.amount,
      responseCode: verification.responseCode,
      transactionStatus: verification.transactionStatus,
      transactionNo: verification.transactionNo
    });
  } catch (error) {
    console.error('VNPay return reconciliation failed', { message: error.message });
  }
  redirectUrl.searchParams.set('status', successful ? 'success' : 'failed');
  redirectUrl.searchParams.set('orderId', verification.txnRef);
  if (verification.responseCode !== null) {
    redirectUrl.searchParams.set('responseCode', verification.responseCode);
  }

  return res.redirect(redirectUrl.toString());
});

router.get('/vnpay/ipn', async (req, res) => {
  const verification = verifyPaymentParams(req.query);
  if (!verification.signatureValid) {
    return res.json(buildVnpayResponse('97', 'Invalid Signature'));
  }
  if (!verification.valid) {
    return res.json(buildVnpayResponse('99', 'Invalid callback'));
  }

  try {
    const result = await reconcileVnpayPayment({
      orderId: verification.txnRef,
      amount: verification.amount,
      responseCode: verification.responseCode,
      transactionStatus: verification.transactionStatus,
      transactionNo: verification.transactionNo
    });
    return res.json(buildVnpayResponse(result.code, result.message));
  } catch (error) {
    console.error('VNPay IPN reconciliation failed', { message: error.message });
    return res.json(buildVnpayResponse('99', 'Unknown error'));
  }
});

module.exports = router;
