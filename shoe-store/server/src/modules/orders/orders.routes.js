const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/asyncHandler');
const { createCodOrder, listCustomerOrders, getCustomerOrder } = require('./orders.service');

const router = express.Router();

router.use(requireAuth);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const order = await createCodOrder(req.user.id, req.body);
    res.status(201).json({ order });
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
