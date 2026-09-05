const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..', '..');

function readDatabaseFile(filename) {
  return fs.readFileSync(path.join(rootDir, 'database', filename), 'utf8');
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

test('seed data includes local users with bcrypt-compatible password hashes and at least eight products', () => {
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

  const productInsert = seed.match(/INSERT INTO products[\s\S]*?VALUES([\s\S]*?);/i);
  assert.notEqual(productInsert, null);

  const productRows = productInsert[1]
    .split('\n')
    .filter((line) => line.trim().startsWith('('));

  assert.equal(productRows.length >= 8, true);
  assert.match(seed, /INSERT INTO product_variants/i);
  assert.match(seed, /INSERT INTO product_images/i);
});
