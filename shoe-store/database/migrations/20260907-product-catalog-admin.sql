CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT categories_status_check CHECK (status IN ('active', 'hidden'))
);

ALTER TABLE product_images
  ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;

INSERT INTO categories (name, slug)
VALUES
  ('Chạy bộ', 'running'),
  ('Sneaker hằng ngày', 'sneakers'),
  ('Trekking và outdoor', 'trail'),
  ('Tập luyện', 'training'),
  ('Đi bộ và du lịch', 'walking'),
  ('Boot', 'boots'),
  ('Tennis', 'tennis'),
  ('Bóng rổ', 'basketball')
ON CONFLICT (slug) DO NOTHING;
