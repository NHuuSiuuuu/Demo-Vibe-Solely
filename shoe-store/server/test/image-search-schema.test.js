const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const dotenv = require('dotenv');
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
  assert.doesNotMatch(table[1], /embedding vector\(768\) NOT NULL/i);
  assert.match(table[1], /embedding_model TEXT NOT NULL/);
  assert.match(table[1], /status TEXT NOT NULL DEFAULT 'active'/);
  assert.match(table[1], /error_message TEXT/);
  assert.match(table[1], /CONSTRAINT product_image_embeddings_status_check CHECK \(status IN \('active', 'needs_reindex', 'error'\)\)/);
  assert.match(table[1], /CONSTRAINT product_image_embeddings_active_embedding_check CHECK \(status <> 'active' OR embedding IS NOT NULL\)/);
  assert.match(table[1], /UNIQUE \(product_image_id, embedding_model\)/);
  assert.match(table[1], /FOREIGN KEY \(product_image_id, product_id\) REFERENCES product_images\(id, product_id\) ON DELETE CASCADE/);
  assert.match(schema, /CREATE TABLE product_images \([\s\S]*UNIQUE \(id, product_id\)[\s\S]*\n\);/);
  assert.match(schema, /CREATE INDEX product_image_embeddings_embedding_idx ON product_image_embeddings USING ivfflat \(embedding vector_cosine_ops\)/i);
  assert.match(schema, /CREATE INDEX product_image_embeddings_product_id_idx ON product_image_embeddings\(product_id\)/i);
  assert.match(schema, /CREATE INDEX product_image_embeddings_product_image_id_idx ON product_image_embeddings\(product_image_id\)/i);
});

test('image embedding schema migration is ordered after the committed product catalog migration', () => {
  const runner = readProjectFile('scripts', 'db-migrate.js');
  const migration = readProjectFile('database', 'migrations', '20260907-product-image-search.sql');

  const catalogMigrationIndex = runner.indexOf("'20260907-product-catalog-admin.sql'");
  const imageMigrationIndex = runner.indexOf("'20260907-product-image-search.sql'");
  assert.equal(catalogMigrationIndex >= 0, true);
  assert.equal(imageMigrationIndex > catalogMigrationIndex, true);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS product_image_embeddings/i);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS product_image_embeddings_embedding_idx/i);
  assert.match(migration, /ALTER TABLE product_image_embeddings\s+ALTER COLUMN embedding DROP NOT NULL/i);
});

function configuredDatabaseUrl() {
  const testDefault = 'postgres://localhost/shoe_store_test';
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== testDefault) {
    return process.env.DATABASE_URL;
  }

  const envPath = path.join(root, 'server', '.env');
  if (!fs.existsSync(envPath)) return null;
  return dotenv.parse(fs.readFileSync(envPath, 'utf8')).DATABASE_URL || null;
}

function runMigration(databaseUrl) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'db-migrate.js')], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8'
  });
}

test('image embedding schema integration is idempotent and enforces pgvector integrity', async (t) => {
  const databaseUrl = configuredDatabaseUrl();
  if (!databaseUrl) {
    t.skip('DATABASE_URL is not configured');
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
  } catch (error) {
    t.skip(`configured PostgreSQL is unavailable: ${error.code || error.message}`);
    return;
  }

  const cleanup = [];
  t.after(async () => {
    for (const query of cleanup.reverse()) {
      await client.query(query).catch(() => {});
    }
    await client.end();
  });

  const extension = await client.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'");
  if (extension.rowCount !== 1) {
    t.skip('pgvector extension is not installed');
    return;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = runMigration(databaseUrl);
    assert.equal(result.status, 0, `migration failed: ${result.stderr}`);
  }

  const suffix = `${Date.now()}_${process.pid}`;
  const product = await client.query(
    `INSERT INTO products (slug, name, description, brand, category, gender, base_price)
     VALUES ($1, $2, 'schema integration sentinel', 'Test', 'sneakers', 'unisex', 1)
     RETURNING id`,
    [`schema-sentinel-${suffix}`, `Schema Sentinel ${suffix}`]
  );
  const productId = product.rows[0].id;
  cleanup.push('DELETE FROM products WHERE id = ' + Number(productId));

  const image = await client.query(
    `INSERT INTO product_images (product_id, image_url, alt_text)
     VALUES ($1, 'https://example.invalid/sentinel.png', 'schema sentinel')
     RETURNING id`,
    [productId]
  );
  const imageId = image.rows[0].id;
  const vector = `[${Array(768).fill('0').join(',')}]`;
  const model = `schema-test-${suffix}`;

  await client.query(
    `INSERT INTO product_image_embeddings
      (product_id, product_image_id, embedding, embedding_model)
     VALUES ($1, $2, $3::vector, $4)`,
    [productId, imageId, vector, model]
  );

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = runMigration(databaseUrl);
    assert.equal(result.status, 0, `repeat migration failed: ${result.stderr}`);
  }

  const sentinel = await client.query(
    'SELECT product_id, product_image_id FROM product_image_embeddings WHERE embedding_model = $1',
    [model]
  );
  assert.deepEqual(sentinel.rows, [{ product_id: productId, product_image_id: imageId }]);

  await assert.rejects(
    client.query(
      `INSERT INTO product_image_embeddings (product_id, product_image_id, embedding_model, status)
       VALUES ($1, $2, $3, 'invalid')`,
      [productId, imageId, `${model}-invalid-status`]
    )
  );
  await assert.rejects(
    client.query(
      `INSERT INTO product_image_embeddings
        (product_id, product_image_id, embedding, embedding_model)
       VALUES ($1, $2, $3::vector, $4)`,
      [productId, imageId, vector, model]
    )
  );
  await client.query(
    `INSERT INTO product_image_embeddings (product_id, product_image_id, embedding_model, status)
     VALUES ($1, $2, $3, 'error')`,
    [productId, imageId, `${model}-error`]
  );

  const ownershipProduct = await client.query(
    `INSERT INTO products (slug, name, description, brand, category, gender, base_price)
     VALUES ($1, 'Cascade Sentinel', 'cascade sentinel', 'Test', 'sneakers', 'unisex', 1)
     RETURNING id`,
    [`cascade-sentinel-${suffix}`]
  );
  const ownershipProductId = ownershipProduct.rows[0].id;
  const ownershipImage = await client.query(
    `INSERT INTO product_images (product_id, image_url, alt_text)
     VALUES ($1, 'https://example.invalid/cascade.png', 'cascade sentinel')
     RETURNING id`,
    [ownershipProductId]
  );
  await client.query(
    `INSERT INTO product_image_embeddings
      (product_id, product_image_id, embedding, embedding_model)
     VALUES ($1, $2, $3::vector, $4)`,
    [ownershipProductId, ownershipImage.rows[0].id, vector, `${model}-cascade`]
  );
  await assert.rejects(
    client.query(
      `INSERT INTO product_image_embeddings
        (product_id, product_image_id, embedding, embedding_model)
       VALUES ($1, $2, $3::vector, $4)`,
      [productId, ownershipImage.rows[0].id, vector, `${model}-wrong-owner`]
    )
  );
  await client.query('DELETE FROM products WHERE id = $1', [ownershipProductId]);
  const cascaded = await client.query(
    'SELECT 1 FROM product_image_embeddings WHERE embedding_model = $1',
    [`${model}-cascade`]
  );
  assert.equal(cascaded.rowCount, 0);

  const embeddingType = await client.query(
    `SELECT format_type(a.atttypid, a.atttypmod) AS type
     FROM pg_attribute a
     WHERE a.attrelid = 'product_image_embeddings'::regclass AND a.attname = 'embedding'`
  );
  assert.equal(embeddingType.rows[0].type, 'vector(768)');

  const vectorIndex = await client.query(
    `SELECT indexdef FROM pg_indexes WHERE indexname = 'product_image_embeddings_embedding_idx'`
  );
  assert.match(vectorIndex.rows[0].indexdef, /USING ivfflat/i);
  assert.match(vectorIndex.rows[0].indexdef, /vector_cosine_ops/i);

  const ownershipConstraint = await client.query(
    `SELECT pg_get_constraintdef(oid) AS definition
     FROM pg_constraint
     WHERE conrelid = 'product_image_embeddings'::regclass AND contype = 'f'`
  );
  assert.equal(
    ownershipConstraint.rows.some(({ definition }) => definition.includes('FOREIGN KEY (product_image_id, product_id)')),
    true
  );
});
