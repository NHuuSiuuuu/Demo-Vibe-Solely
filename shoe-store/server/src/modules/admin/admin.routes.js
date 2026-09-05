const express = require('express');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/asyncHandler');
const {
  getDashboard,
  listProducts,
  createProduct,
  updateProduct,
  createVariant,
  updateVariant,
  listOrders,
  getOrder,
  updateOrderStatus
} = require('./admin.service');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const dashboard = await getDashboard();
    res.json({ dashboard });
  })
);

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const products = await listProducts();
    res.json({ products });
  })
);

router.post(
  '/products',
  asyncHandler(async (req, res) => {
    const product = await createProduct(req.body);
    res.status(201).json({ product });
  })
);

router.patch(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await updateProduct(req.params.id, req.body);
    res.json({ product });
  })
);

router.post(
  '/products/:id/variants',
  asyncHandler(async (req, res) => {
    const variant = await createVariant(req.params.id, req.body);
    res.status(201).json({ variant });
  })
);

router.patch(
  '/variants/:id',
  asyncHandler(async (req, res) => {
    const variant = await updateVariant(req.params.id, req.body);
    res.json({ variant });
  })
);

router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const orders = await listOrders();
    res.json({ orders });
  })
);

router.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const order = await getOrder(req.params.id);
    res.json({ order });
  })
);

router.patch(
  '/orders/:id/status',
  asyncHandler(async (req, res) => {
    const order = await updateOrderStatus(req.params.id, req.body.status);
    res.json({ order });
  })
);

module.exports = router;
