const express = require('express');
const { requireAuth, requireCustomer } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/asyncHandler');
const { createOrder, listCustomerOrders, getCustomerOrder } = require('./orders.service');

const router = express.Router();

router.use(requireAuth, requireCustomer);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const result = await createOrder(req.user.id, req.body || {}, req.ip);
    res.status(201).json(result);
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const orders = await listCustomerOrders(req.user.id);
    res.json({ orders });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await getCustomerOrder(req.user.id, req.params.id);
    res.json({ order });
  })
);

module.exports = router;
