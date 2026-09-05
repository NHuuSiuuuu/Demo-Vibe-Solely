const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/asyncHandler');
const { getCart, addCartItem, updateCartItem, removeCartItem } = require('./cart.service');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const cart = await getCart(req.user.id);
    res.json({ cart });
  })
);

router.post(
  '/items',
  asyncHandler(async (req, res) => {
    const cart = await addCartItem(req.user.id, req.body);
    res.status(201).json({ cart });
  })
);

router.patch(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const cart = await updateCartItem(req.user.id, req.params.id, req.body);
    res.json({ cart });
  })
);

router.delete(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const cart = await removeCartItem(req.user.id, req.params.id);
    res.json({ cart });
  })
);

module.exports = router;
