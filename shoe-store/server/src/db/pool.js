const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { PGlite } = require('@electric-sql/pglite');
const { env } = require('../config/env');

let demoDbPromise = null;

function makeDemoSchema(sql) {
  return sql
    .replace(/CREATE EXTENSION IF NOT EXISTS vector;\s*/i, '')
    .replace(/embedding vector\(768\)/i, 'embedding TEXT')
    .replace(/CREATE INDEX rag_chunks_embedding_idx ON rag_chunks USING ivfflat \(embedding vector_cosine_ops\) WITH \(lists = 100\);\s*/i, '');
}

async function createDemoDb() {
  const db = new PGlite();
  const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
  const seedPath = path.resolve(__dirname, '../../../database/seed.sql');

  await db.exec(makeDemoSchema(fs.readFileSync(schemaPath, 'utf8')));
  await db.exec(fs.readFileSync(seedPath, 'utf8'));
  console.warn('DATABASE_URL is not set. Using in-memory demo database.');
  return db;
}

function normalizeResult(result) {
  return {
    ...result,
    rowCount: result.affectedRows ?? result.rows.length
  };
}

function getDemoDb() {
  if (!demoDbPromise) {
    demoDbPromise = createDemoDb();
  }
  return demoDbPromise;
}

async function demoQuery(text, params) {
  const db = await getDemoDb();
  return normalizeResult(await db.query(text, params));
}

const pool = env.DATABASE_URL
  ? new Pool({ connectionString: env.DATABASE_URL })
  : {
      async query(text, params) {
        return demoQuery(text, params);
      },
      async connect() {
        const db = await getDemoDb();
        return {
          async query(text, params) {
            return normalizeResult(await db.query(text, params));
          },
          release() {}
        };
      }
    };

function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
