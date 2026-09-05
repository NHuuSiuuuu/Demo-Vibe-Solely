const express = require('express');
const { asyncHandler } = require('../../utils/asyncHandler');
const { requireAuth } = require('../../middleware/auth');
const { registerCustomer, login } = require('./auth.service');

const router = express.Router();

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const result = await registerCustomer(req.body || {});
    res.status(201).json(result);
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const result = await login(req.body || {});
    res.json(result);
  })
);

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
