const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');

function readProjectFile(...parts) {
  return fs.readFileSync(path.join(root, ...parts), 'utf8');
}

test('image embedding schema defines the table, constraints, and vector index', () => {
  const schema = readProjectFile('database', 'schema.sql');
  const table = schema.match(/CREATE TABLE product_image_embeddings \(([\s\S]*?)\n\);/);

  assert.match(schema, /DROP TABLE IF EXISTS product_image_embeddings;/i);
  assert.notEqual(table, null);
  assert.match(table[1], /product_id BIGINT NOT NULL REFERENCES products\(id\) ON DELETE CASCADE/);
  assert.match(table[1], /product_image_id BIGINT NOT NULL REFERENCES product_images\(id\) ON DELETE CASCADE/);
  assert.match(table[1], /embedding vector\(768\)/i);
  assert.match(table[1], /embedding_model TEXT NOT NULL/);
  assert.match(table[1], /status TEXT NOT NULL DEFAULT 'active'/);
  assert.match(table[1], /error_message TEXT/);
  assert.match(table[1], /CONSTRAINT product_image_embeddings_status_check CHECK \(status IN \('active', 'needs_reindex', 'error'\)\)/);
  assert.match(table[1], /UNIQUE \(product_image_id, embedding_model\)/);
  assert.match(schema, /CREATE INDEX product_image_embeddings_embedding_idx ON product_image_embeddings USING ivfflat \(embedding vector_cosine_ops\)/i);
  assert.match(schema, /CREATE INDEX product_image_embeddings_product_id_idx ON product_image_embeddings\(product_id\)/i);
  assert.match(schema, /CREATE INDEX product_image_embeddings_product_image_id_idx ON product_image_embeddings\(product_image_id\)/i);
});

test('image embedding migration is ordered after the product catalog migrations', () => {
  const runner = readProjectFile('scripts', 'db-migrate.js');
  const migration = readProjectFile('database', 'migrations', '20260907-product-image-search.sql');

  assert.match(runner, /'20260907-product-catalog-admin\.sql',[\s\S]*'20260907-vnpay-discount\.sql',[\s\S]*'20260907-refund-status\.sql',[\s\S]*'20260907-product-image-search\.sql'/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS product_image_embeddings/i);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS product_image_embeddings_embedding_idx/i);
});
