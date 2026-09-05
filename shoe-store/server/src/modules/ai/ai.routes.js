const express = require('express');
const { requireAuth, requireCustomer } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/asyncHandler');
const { adviseProducts } = require('./ai.service');

const router = express.Router();

router.post(
  '/chat',
  requireAuth,
  requireCustomer,
  asyncHandler(async (req, res) => {
    const result = await adviseProducts({ user: req.user, message: req.body.message });
    res.json(result);
  })
);

module.exports = router;
