DROP TABLE IF EXISTS ai_chat_messages;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS carts;
DROP TABLE IF EXISTS product_variants;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS payment_status;
DROP TYPE IF EXISTS payment_method;
DROP TYPE IF EXISTS order_status;
DROP TYPE IF EXISTS product_status;
DROP TYPE IF EXISTS user_role;

CREATE TYPE user_role AS ENUM ('customer', 'admin');
CREATE TYPE product_status AS ENUM ('active', 'hidden');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'shipping', 'completed', 'cancelled');
CREATE TYPE payment_method AS ENUM ('cod');
CREATE TYPE payment_status AS ENUM ('unpaid', 'paid');

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'customer',
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  brand TEXT NOT NULL,
  category TEXT NOT NULL,
  gender TEXT NOT NULL,
  base_price NUMERIC(10, 2) NOT NULL,
  status product_status NOT NULL DEFAULT 'active',
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_images (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE product_variants (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  size TEXT NOT NULL,
  color TEXT NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  price_delta NUMERIC(10, 2) NOT NULL DEFAULT 0
);

CREATE TABLE carts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cart_items (
  id BIGSERIAL PRIMARY KEY,
  cart_id BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_variant_id BIGINT NOT NULL REFERENCES product_variants(id),
  quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, product_variant_id)
);

CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  order_code TEXT NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  shipping_address_line1 TEXT NOT NULL,
  shipping_address_line2 TEXT,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT NOT NULL,
  shipping_postal_code TEXT NOT NULL,
  shipping_country TEXT NOT NULL DEFAULT 'US',
  subtotal NUMERIC(10, 2) NOT NULL,
  shipping_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(10, 2) NOT NULL,
  note TEXT,
  order_status order_status NOT NULL DEFAULT 'pending',
  payment_method payment_method NOT NULL DEFAULT 'cod',
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  size TEXT NOT NULL,
  color TEXT NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  quantity INTEGER NOT NULL,
  line_total NUMERIC(10, 2) NOT NULL
);

CREATE TABLE ai_chat_messages (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
ALTER TABLE products ADD CONSTRAINT products_slug_unique UNIQUE (slug);
ALTER TABLE product_variants ADD CONSTRAINT product_variants_sku_unique UNIQUE (sku);
ALTER TABLE orders ADD CONSTRAINT orders_order_code_unique UNIQUE (order_code);
ALTER TABLE product_variants ADD CONSTRAINT product_variants_stock_nonnegative CHECK (stock_quantity >= 0);
ALTER TABLE cart_items ADD CONSTRAINT cart_items_quantity_positive CHECK (quantity > 0);
ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0);

CREATE INDEX product_images_product_id_idx ON product_images(product_id);
CREATE INDEX product_variants_product_id_idx ON product_variants(product_id);
CREATE INDEX cart_items_cart_id_idx ON cart_items(cart_id);
CREATE INDEX order_items_order_id_idx ON order_items(order_id);
CREATE INDEX ai_chat_messages_session_id_idx ON ai_chat_messages(session_id);
