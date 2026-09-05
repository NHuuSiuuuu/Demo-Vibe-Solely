INSERT INTO users (email, password_hash, role, first_name, last_name)
VALUES
  ('admin@shoestore.local', '$2b$12$/VpCnQLi8HuQbZit6FN0FOTxrCuA8CmGNhO6iQU27CV0mKRFMTYKy', 'admin', 'Store', 'Admin'),
  ('customer@shoestore.local', '$2b$12$oJt7X6EmgbWD56HkMxLbKuA4DkvmpD5RiXZj8CqUuM1AOQPfD4/OW', 'customer', 'Sample', 'Customer');

INSERT INTO products (slug, name, description, brand, category, gender, base_price, status, featured)
VALUES
  ('urban-runner-knit', 'Urban Runner Knit', 'Lightweight everyday running shoe with breathable knit support.', 'StrideCo', 'running', 'unisex', 89.00, 'active', true),
  ('court-classic-low', 'Court Classic Low', 'Clean low-top sneaker with cushioned insole and durable cupsole.', 'Northline', 'sneakers', 'unisex', 74.00, 'active', true),
  ('trail-guard-pro', 'Trail Guard Pro', 'Stable trail shoe with lugged outsole and reinforced toe guard.', 'SummitLab', 'trail', 'men', 118.00, 'active', false),
  ('studio-flex-slip-on', 'Studio Flex Slip-On', 'Flexible slip-on trainer built for studio workouts and quick errands.', 'AeroForm', 'training', 'women', 68.00, 'active', false),
  ('heritage-leather-boot', 'Heritage Leather Boot', 'Full-grain leather boot with padded collar and grippy rubber sole.', 'Oak & Anvil', 'boots', 'men', 145.00, 'active', true),
  ('cloud-step-walker', 'Cloud Step Walker', 'Supportive walking shoe with soft foam midsole and wide-fit comfort.', 'StrideCo', 'walking', 'women', 82.00, 'active', false),
  ('metro-suede-high', 'Metro Suede High', 'High-top suede sneaker with contrast stitching and ankle support.', 'Northline', 'sneakers', 'men', 96.00, 'active', false),
  ('rain-ready-chelsea', 'Rain Ready Chelsea', 'Water-resistant Chelsea boot with easy pull tabs and textured sole.', 'AeroForm', 'boots', 'women', 132.00, 'active', true);

INSERT INTO product_images (product_id, image_url, alt_text, sort_order)
SELECT id, 'https://placehold.co/900x700/png?text=Urban+Runner+Knit', 'Urban Runner Knit in slate and white', 1
FROM products WHERE slug = 'urban-runner-knit'
UNION ALL
SELECT id, 'https://placehold.co/900x700/png?text=Court+Classic+Low', 'Court Classic Low white sneaker', 1
FROM products WHERE slug = 'court-classic-low'
UNION ALL
SELECT id, 'https://placehold.co/900x700/png?text=Trail+Guard+Pro', 'Trail Guard Pro olive trail shoe', 1
FROM products WHERE slug = 'trail-guard-pro'
UNION ALL
SELECT id, 'https://placehold.co/900x700/png?text=Studio+Flex+Slip-On', 'Studio Flex Slip-On black trainer', 1
FROM products WHERE slug = 'studio-flex-slip-on'
UNION ALL
SELECT id, 'https://placehold.co/900x700/png?text=Heritage+Leather+Boot', 'Heritage Leather Boot brown leather boot', 1
FROM products WHERE slug = 'heritage-leather-boot'
UNION ALL
SELECT id, 'https://placehold.co/900x700/png?text=Cloud+Step+Walker', 'Cloud Step Walker gray walking shoe', 1
FROM products WHERE slug = 'cloud-step-walker'
UNION ALL
SELECT id, 'https://placehold.co/900x700/png?text=Metro+Suede+High', 'Metro Suede High navy high-top sneaker', 1
FROM products WHERE slug = 'metro-suede-high'
UNION ALL
SELECT id, 'https://placehold.co/900x700/png?text=Rain+Ready+Chelsea', 'Rain Ready Chelsea black boot', 1
FROM products WHERE slug = 'rain-ready-chelsea';

INSERT INTO product_variants (product_id, sku, size, color, stock_quantity, price_delta)
SELECT id, 'URK-SLT-8', '8', 'Slate', 14, 0 FROM products WHERE slug = 'urban-runner-knit'
UNION ALL SELECT id, 'URK-SLT-9', '9', 'Slate', 18, 0 FROM products WHERE slug = 'urban-runner-knit'
UNION ALL SELECT id, 'URK-WHT-9', '9', 'White', 9, 0 FROM products WHERE slug = 'urban-runner-knit'
UNION ALL SELECT id, 'CCL-WHT-7', '7', 'White', 20, 0 FROM products WHERE slug = 'court-classic-low'
UNION ALL SELECT id, 'CCL-WHT-8', '8', 'White', 16, 0 FROM products WHERE slug = 'court-classic-low'
UNION ALL SELECT id, 'CCL-BLK-9', '9', 'Black', 11, 0 FROM products WHERE slug = 'court-classic-low'
UNION ALL SELECT id, 'TGP-OLV-10', '10', 'Olive', 7, 0 FROM products WHERE slug = 'trail-guard-pro'
UNION ALL SELECT id, 'TGP-OLV-11', '11', 'Olive', 6, 0 FROM products WHERE slug = 'trail-guard-pro'
UNION ALL SELECT id, 'TGP-GRY-10', '10', 'Gray', 5, 0 FROM products WHERE slug = 'trail-guard-pro'
UNION ALL SELECT id, 'SFS-BLK-6', '6', 'Black', 15, 0 FROM products WHERE slug = 'studio-flex-slip-on'
UNION ALL SELECT id, 'SFS-BLK-7', '7', 'Black', 13, 0 FROM products WHERE slug = 'studio-flex-slip-on'
UNION ALL SELECT id, 'SFS-SND-8', '8', 'Sand', 10, 0 FROM products WHERE slug = 'studio-flex-slip-on'
UNION ALL SELECT id, 'HLB-BRN-10', '10', 'Brown', 8, 0 FROM products WHERE slug = 'heritage-leather-boot'
UNION ALL SELECT id, 'HLB-BRN-11', '11', 'Brown', 6, 0 FROM products WHERE slug = 'heritage-leather-boot'
UNION ALL SELECT id, 'HLB-BLK-10', '10', 'Black', 4, 10 FROM products WHERE slug = 'heritage-leather-boot'
UNION ALL SELECT id, 'CSW-GRY-6', '6', 'Gray', 17, 0 FROM products WHERE slug = 'cloud-step-walker'
UNION ALL SELECT id, 'CSW-GRY-7', '7', 'Gray', 15, 0 FROM products WHERE slug = 'cloud-step-walker'
UNION ALL SELECT id, 'CSW-NVY-8', '8', 'Navy', 12, 0 FROM products WHERE slug = 'cloud-step-walker'
UNION ALL SELECT id, 'MSH-NVY-9', '9', 'Navy', 10, 0 FROM products WHERE slug = 'metro-suede-high'
UNION ALL SELECT id, 'MSH-NVY-10', '10', 'Navy', 8, 0 FROM products WHERE slug = 'metro-suede-high'
UNION ALL SELECT id, 'MSH-TAN-10', '10', 'Tan', 7, 0 FROM products WHERE slug = 'metro-suede-high'
UNION ALL SELECT id, 'RRC-BLK-6', '6', 'Black', 9, 0 FROM products WHERE slug = 'rain-ready-chelsea'
UNION ALL SELECT id, 'RRC-BLK-7', '7', 'Black', 11, 0 FROM products WHERE slug = 'rain-ready-chelsea'
UNION ALL SELECT id, 'RRC-GRN-8', '8', 'Green', 5, 0 FROM products WHERE slug = 'rain-ready-chelsea';
