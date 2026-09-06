const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..', '..');

function readDatabaseFile(filename) {
  return fs.readFileSync(path.join(rootDir, 'database', filename), 'utf8');
}

function extractProductRows(sql) {
  const productInsert = sql.match(/INSERT INTO products[\s\S]*?VALUES([\s\S]*?);/i);
  assert.notEqual(productInsert, null);

  return [...productInsert[1].matchAll(
    /\('([^']+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)',\s*(\d+),\s*'active'/g
  )].map((match) => ({
    slug: match[1],
    name: match[2],
    description: match[3],
    brand: match[4],
    category: match[5],
    gender: match[6],
    price: Number(match[7])
  }));
}

test('schema defines the required PostgreSQL enums, tables, and constraints', () => {
  const schema = readDatabaseFile('schema.sql');

  [
    "CREATE TYPE user_role AS ENUM ('customer', 'admin');",
    "CREATE TYPE product_status AS ENUM ('active', 'hidden');",
    "CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'shipping', 'completed', 'cancelled');",
    "CREATE TYPE payment_method AS ENUM ('cod');",
    "CREATE TYPE payment_status AS ENUM ('unpaid', 'paid');",
    'ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);',
    'ALTER TABLE products ADD CONSTRAINT products_slug_unique UNIQUE (slug);',
    'ALTER TABLE product_variants ADD CONSTRAINT product_variants_sku_unique UNIQUE (sku);',
    'ALTER TABLE orders ADD CONSTRAINT orders_order_code_unique UNIQUE (order_code);',
    'ALTER TABLE product_variants ADD CONSTRAINT product_variants_stock_nonnegative CHECK (stock_quantity >= 0);',
    'ALTER TABLE cart_items ADD CONSTRAINT cart_items_quantity_positive CHECK (quantity > 0);',
    'ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0);'
  ].forEach((requiredSql) => {
    assert.equal(schema.includes(requiredSql), true, `missing SQL: ${requiredSql}`);
  });

  [
    'users',
    'products',
    'product_images',
    'product_variants',
    'carts',
    'cart_items',
    'orders',
    'order_items',
    'ai_chat_messages'
  ].forEach((tableName) => {
    assert.match(schema, new RegExp(`CREATE TABLE ${tableName}\\b`));
  });
});

test('orders table exposes order_status column for later API code', () => {
  const schema = readDatabaseFile('schema.sql');
  const ordersTable = schema.match(/CREATE TABLE orders \(([\s\S]*?)\n\);/);

  assert.notEqual(ordersTable, null);
  assert.match(ordersTable[1], /\border_code TEXT NOT NULL/);
  assert.match(ordersTable[1], /\bnote TEXT/);
  assert.match(ordersTable[1], /\border_status order_status NOT NULL DEFAULT 'pending'/);
  assert.doesNotMatch(ordersTable[1], /\n\s+status order_status\b/);
});

test('seed data includes local users with bcrypt-compatible password hashes and at least twenty products', () => {
  const seed = readDatabaseFile('seed.sql');

  assert.match(seed, /admin@shoestore\.local/);
  assert.match(seed, /customer@shoestore\.local/);
  assert.doesNotMatch(seed, /Admin123!/);
  assert.doesNotMatch(seed, /Customer123!/);

  const userRows = [...seed.matchAll(/\('([^']+@shoestore\.local)', '([^']+)', '(admin|customer)'/g)];
  assert.equal(userRows.length, 2);
  userRows.forEach((row) => {
    assert.match(row[2], /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/);
  });

  const productRows = extractProductRows(seed);

  assert.equal(productRows.length >= 20, true);
  assert.match(seed, /INSERT INTO product_variants/i);
  assert.match(seed, /INSERT INTO product_images/i);
});

test('seed data uses VND-scale prices and real product images', () => {
  const seed = readDatabaseFile('seed.sql');
  const productRows = extractProductRows(seed);

  assert.equal(productRows.length >= 8, true);
  productRows.forEach((product) => {
    assert.equal(product.price >= 500000, true);
  });

  assert.doesNotMatch(seed, /placehold\.co/i);
  assert.match(seed, /images\.unsplash\.com/);
});

test('seed data includes a RAG-ready catalog with rich product descriptions', () => {
  const seed = readDatabaseFile('seed.sql');
  const localize = readDatabaseFile('localize-vietnamese-products.sql');
  const productRows = extractProductRows(seed);

  assert.equal(productRows.length >= 20, true);
  productRows.forEach((product) => {
    assert.equal(product.description.length >= 140, true, `${product.slug} description is too short`);
    assert.match(product.description, /Phù hợp|Mục đích|Đệm|Độ bám|Chất liệu|Form|Gợi ý/i);
  });

  ['running', 'sneakers', 'trail', 'training', 'walking', 'boots'].forEach((category) => {
    assert.equal(productRows.some((product) => product.category === category), true, `missing category ${category}`);
  });

  productRows.forEach((product) => {
    assert.match(localize, new RegExp(product.slug));
  });
});

test('schema defines RAG documents, chunks, pgvector extension, and vector indexes', () => {
  const schema = readDatabaseFile('schema.sql');

  assert.match(schema, /CREATE EXTENSION IF NOT EXISTS vector/i);
  assert.match(schema, /CREATE TABLE rag_documents/i);
  assert.match(schema, /CREATE TABLE rag_chunks/i);
  assert.match(schema, /embedding vector\(768\)/i);
  assert.match(schema, /rag_chunks_source_idx/i);
  assert.match(schema, /rag_chunks_embedding_idx/i);
});

test('seed data includes default RAG policy documents', () => {
  const seed = readDatabaseFile('seed.sql');

  ['Cách đặt hàng', 'Thanh toán COD', 'Vận chuyển', 'Đổi trả', 'Bảo hành', 'Hướng dẫn chọn size', 'Điều khoản mua hàng'].forEach((title) => {
    assert.match(seed, new RegExp(title));
  });
});

test('database setup applies localization after schema and seed files', () => {
  const setup = fs.readFileSync(path.join(rootDir, 'scripts', 'db-setup.js'), 'utf8');

  assert.match(setup, /'database\/schema\.sql',\s*'database\/seed\.sql',\s*'database\/localize-vietnamese-products\.sql'/);
});

test('database setup stops when psql reports a SQL error', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoestore-db-setup-'));
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const fakePsqlPath = path.join(tempDir, 'psql');
  fs.writeFileSync(
    fakePsqlPath,
    `#!/usr/bin/env node
const hasOnErrorStop = process.argv.includes('ON_ERROR_STOP=1');
console.error('ERROR: extension "vector" is not available');
process.exit(hasOnErrorStop ? 3 : 0);
`,
    { mode: 0o755 }
  );

  const result = spawnSync(process.execPath, [path.join(rootDir, 'scripts', 'db-setup.js')], {
    cwd: rootDir,
    env: {
      ...process.env,
      DATABASE_URL: 'postgres://shoestore:test@localhost:5432/shoe_store',
      PATH: `${tempDir}${path.delimiter}${process.env.PATH}`
    },
    encoding: 'utf8'
  });

  assert.equal(result.status, 3);
  assert.match(result.stderr, /extension "vector" is not available/);
});
