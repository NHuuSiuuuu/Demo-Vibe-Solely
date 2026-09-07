DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_images_id_product_id_unique'
      AND conrelid = 'product_images'::regclass
  ) THEN
    ALTER TABLE product_images
      ADD CONSTRAINT product_images_id_product_id_unique UNIQUE (id, product_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS product_image_embeddings (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_image_id BIGINT NOT NULL REFERENCES product_images(id) ON DELETE CASCADE,
  embedding vector(768),
  embedding_model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_image_embeddings_status_check CHECK (status IN ('active', 'needs_reindex', 'error')),
  CONSTRAINT product_image_embeddings_active_embedding_check CHECK (status <> 'active' OR embedding IS NOT NULL),
  FOREIGN KEY (product_image_id, product_id) REFERENCES product_images(id, product_id) ON DELETE CASCADE,
  UNIQUE (product_image_id, embedding_model)
);

ALTER TABLE product_image_embeddings
  ALTER COLUMN embedding DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_image_embeddings_active_embedding_check'
      AND conrelid = 'product_image_embeddings'::regclass
  ) THEN
    ALTER TABLE product_image_embeddings
      ADD CONSTRAINT product_image_embeddings_active_embedding_check
      CHECK (status <> 'active' OR embedding IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_image_embeddings_product_image_product_fk'
      AND conrelid = 'product_image_embeddings'::regclass
  ) THEN
    ALTER TABLE product_image_embeddings
      ADD CONSTRAINT product_image_embeddings_product_image_product_fk
      FOREIGN KEY (product_image_id, product_id)
      REFERENCES product_images(id, product_id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS product_image_embeddings_product_id_idx
  ON product_image_embeddings(product_id);

CREATE INDEX IF NOT EXISTS product_image_embeddings_product_image_id_idx
  ON product_image_embeddings(product_image_id);

CREATE INDEX IF NOT EXISTS product_image_embeddings_status_idx
  ON product_image_embeddings(status);

CREATE INDEX IF NOT EXISTS product_image_embeddings_embedding_idx
  ON product_image_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
