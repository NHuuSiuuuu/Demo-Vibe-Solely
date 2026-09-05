const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'shoe-store-api' });
  });

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
