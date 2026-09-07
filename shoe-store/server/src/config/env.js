require('dotenv').config();

const env = {
  PORT: Number(process.env.PORT || 5000),
  DATABASE_URL: process.env.DATABASE_URL || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
  GEMINI_EMBEDDING_DIMENSIONS: Number(process.env.GEMINI_EMBEDDING_DIMENSIONS || 768),
  GEMINI_CHAT_MODEL: process.env.GEMINI_CHAT_MODEL || 'gemini-3.6-flash',
  RAG_TOP_K: Number(process.env.RAG_TOP_K || 6),
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  VNPAY_HOST: process.env.VNPAY_HOST || 'https://sandbox.vnpayment.vn',
  VNPAY_TMN_CODE: process.env.VNPAY_TMN_CODE || '',
  VNPAY_SECURE_SECRET: process.env.VNPAY_SECURE_SECRET || '',
  VNPAY_RETURN_URL: process.env.VNPAY_RETURN_URL || '',
  VNPAY_IPN_URL: process.env.VNPAY_IPN_URL || '',
  VNPAY_TEST_MODE: String(process.env.VNPAY_TEST_MODE || 'true').toLowerCase() === 'true',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173'
};

module.exports = { env };
