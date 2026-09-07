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

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS vnpay_transaction_no TEXT,
  ADD COLUMN IF NOT EXISTS vnpay_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS vnpay_updated_at TIMESTAMPTZ;
