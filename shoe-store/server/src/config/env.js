require('dotenv').config();

const env = {
  PORT: Number(process.env.PORT || 5000),
  DATABASE_URL: process.env.DATABASE_URL || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
  GEMINI_EMBEDDING_DIMENSIONS: Number(process.env.GEMINI_EMBEDDING_DIMENSIONS || 768),
  GEMINI_CHAT_MODEL: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
  RAG_TOP_K: Number(process.env.RAG_TOP_K || 6)
};

module.exports = { env };
