const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./modules/auth/auth.routes');
const productRoutes = require('./modules/products/products.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const orderRoutes = require('./modules/orders/orders.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const aiRoutes = require('./modules/ai/ai.routes');
const ragRoutes = require('./modules/rag/rag.routes');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'shoe-store-api' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/admin/rag', ragRoutes);
  app.use('/api/ai', aiRoutes);

  app.use('/api', (req, res) => {
    res.status(404).json({ message: 'Not found', details: null });
  });

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
