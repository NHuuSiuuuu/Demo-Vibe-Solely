const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..', '..');

function readMigration() {
  return fs.readFileSync(
    path.join(rootDir, 'database', 'migrations', '20260907-vnpay-discount.sql'),
    'utf8'
  );
}

function readRefundMigration() {
  return fs.readFileSync(
    path.join(rootDir, 'database', 'migrations', '20260907-refund-status.sql'),
    'utf8'
  );
}

test('payment migration preserves legacy variant prices while adding discount pricing', () => {
  const migration = readMigration();

  assert.match(migration, /ALTER TABLE product_variants RENAME COLUMN price_delta TO legacy_price_delta/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS legacy_price_delta NUMERIC\(10, 2\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS discount_percent NUMERIC\(5, 2\) NOT NULL DEFAULT 0/);
  assert.match(migration, /ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'vnpay'/);
  assert.match(migration, /ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'pending'/);
  assert.match(migration, /ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'failed'/);
});

test('payment migration adds idempotent VNPay reconciliation columns without destructive SQL', () => {
  const migration = readMigration();

  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|TYPE|COLUMN)\b/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS vnpay_transaction_no TEXT/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS vnpay_amount NUMERIC\(10, 2\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS vnpay_updated_at TIMESTAMPTZ/);
  assert.match(migration, /information_schema\.columns/);
});

test('refund migration adds refund statuses without destructive SQL', () => {
  const migration = readRefundMigration();
  assert.match(migration, /ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refund_pending'/);
  assert.match(migration, /ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refunded'/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP TYPE|DELETE FROM|TRUNCATE/i);
});
