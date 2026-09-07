ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'vnpay';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'failed';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'product_variants'
      AND column_name = 'price_delta'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'product_variants'
      AND column_name = 'legacy_price_delta'
  ) THEN
    ALTER TABLE product_variants RENAME COLUMN price_delta TO legacy_price_delta;
  END IF;
END
$$;

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS legacy_price_delta NUMERIC(10, 2);

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;

-- Initialize only unclassified rows. Re-running must never reactivate a retired delta.
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS legacy_pricing_active BOOLEAN;

UPDATE product_variants
SET legacy_pricing_active = (legacy_price_delta IS NOT NULL AND discount_percent = 0)
WHERE legacy_pricing_active IS NULL;

ALTER TABLE product_variants
  ALTER COLUMN legacy_pricing_active SET DEFAULT FALSE,
  ALTER COLUMN legacy_pricing_active SET NOT NULL;

-- Unknown historical context stays NULL; never infer it from today's catalog.
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS base_price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS vnpay_transaction_no TEXT,
  ADD COLUMN IF NOT EXISTS vnpay_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS vnpay_updated_at TIMESTAMPTZ;
