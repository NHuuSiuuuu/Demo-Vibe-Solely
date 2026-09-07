CREATE TABLE IF NOT EXISTS product_image_embeddings (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_image_id BIGINT NOT NULL REFERENCES product_images(id) ON DELETE CASCADE,
  embedding vector(768) NOT NULL,
  embedding_model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_image_embeddings_status_check CHECK (status IN ('active', 'needs_reindex', 'error')),
  UNIQUE (product_image_id, embedding_model)
);

CREATE INDEX IF NOT EXISTS product_image_embeddings_product_id_idx
  ON product_image_embeddings(product_id);

CREATE INDEX IF NOT EXISTS product_image_embeddings_product_image_id_idx
  ON product_image_embeddings(product_image_id);

CREATE INDEX IF NOT EXISTS product_image_embeddings_status_idx
  ON product_image_embeddings(status);

CREATE INDEX IF NOT EXISTS product_image_embeddings_embedding_idx
  ON product_image_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
