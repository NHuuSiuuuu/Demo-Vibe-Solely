ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refund_pending';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refunded';
