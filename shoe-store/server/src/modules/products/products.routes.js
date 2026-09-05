const express = require('express');
const { asyncHandler } = require('../../utils/asyncHandler');
const { listProducts, getProductBySlug } = require('./products.service');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const products = await listProducts(req.query);
    res.json({ products });
  })
);

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const product = await getProductBySlug(req.params.slug);
    res.json({ product });
  })
);

module.exports = router;
