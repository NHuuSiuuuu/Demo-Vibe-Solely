require('dotenv').config();

const env = {
  PORT: Number(process.env.PORT || 5000),
  DATABASE_URL: process.env.DATABASE_URL || ''
};

module.exports = { env };
