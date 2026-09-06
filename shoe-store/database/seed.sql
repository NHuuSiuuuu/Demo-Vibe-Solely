INSERT INTO users (email, password_hash, role, first_name, last_name)
VALUES
  ('admin@shoestore.local', '$2b$12$/VpCnQLi8HuQbZit6FN0FOTxrCuA8CmGNhO6iQU27CV0mKRFMTYKy', 'admin', 'Quản trị', 'Solely'),
  ('customer@shoestore.local', '$2b$12$oJt7X6EmgbWD56HkMxLbKuA4DkvmpD5RiXZj8CqUuM1AOQPfD4/OW', 'customer', 'Khách hàng', 'Demo');

INSERT INTO products (slug, name, description, brand, category, gender, base_price, status, featured)
VALUES
  ('urban-runner-knit', 'Solely Air Knit', 'Giày chạy bộ hằng ngày nhẹ, thoáng khí và ôm chân êm ái.', 'Solely', 'running', 'unisex', 1890000, 'active', true),
  ('court-classic-low', 'Solely Court Low', 'Sneaker cổ thấp tinh gọn với lót êm và đế bền cho cả ngày.', 'Solely', 'sneakers', 'unisex', 1590000, 'active', true),
  ('trail-guard-pro', 'Solely Trail Guard', 'Giày địa hình vững chắc với đế bám tốt và mũi giày gia cố.', 'Solely', 'trail', 'men', 2490000, 'active', false),
  ('studio-flex-slip-on', 'Solely Studio Slip-On', 'Giày slip-on linh hoạt cho buổi tập nhẹ và những việc nhanh trong ngày.', 'Solely', 'training', 'women', 1390000, 'active', false),
  ('heritage-leather-boot', 'Solely Leather Boot', 'Boot da cao cấp với cổ đệm êm và đế cao su bám chắc.', 'Solely', 'boots', 'men', 3290000, 'active', true),
  ('cloud-step-walker', 'Solely Cloud Walker', 'Giày đi bộ hỗ trợ tốt với đệm foam mềm và phom rộng thoải mái.', 'Solely', 'walking', 'women', 1790000, 'active', false),
  ('metro-suede-high', 'Solely Suede High', 'Sneaker cổ cao bằng suede, đường chỉ tương phản và nâng đỡ cổ chân.', 'Solely', 'sneakers', 'men', 2090000, 'active', false),
  ('rain-ready-chelsea', 'Solely Chelsea Rain', 'Chelsea boot chống nước nhẹ với quai kéo tiện lợi và đế vân bám.', 'Solely', 'boots', 'women', 2990000, 'active', true);

INSERT INTO product_images (product_id, image_url, alt_text, sort_order)
SELECT id, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80', 'Giày Solely Air Knit màu xám đá và trắng', 1
FROM products WHERE slug = 'urban-runner-knit'
UNION ALL
SELECT id, 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80', 'Sneaker Solely Court Low màu trắng', 1
FROM products WHERE slug = 'court-classic-low'
UNION ALL
SELECT id, 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=900&q=80', 'Giày địa hình Solely Trail Guard màu olive', 1
FROM products WHERE slug = 'trail-guard-pro'
UNION ALL
SELECT id, 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=900&q=80', 'Giày tập Solely Studio Slip-On màu đen', 1
FROM products WHERE slug = 'studio-flex-slip-on'
UNION ALL
SELECT id, 'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?auto=format&fit=crop&w=900&q=80', 'Boot da Solely Leather Boot màu nâu', 1
FROM products WHERE slug = 'heritage-leather-boot'
UNION ALL
SELECT id, 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=80', 'Giày đi bộ Solely Cloud Walker màu xám', 1
FROM products WHERE slug = 'cloud-step-walker'
UNION ALL
SELECT id, 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=900&q=80', 'Sneaker cổ cao Solely Suede High màu xanh navy', 1
FROM products WHERE slug = 'metro-suede-high'
UNION ALL
SELECT id, 'https://images.unsplash.com/photo-1605408499391-6368c628ef42?auto=format&fit=crop&w=900&q=80', 'Chelsea boot Solely Chelsea Rain màu đen', 1
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
UNION ALL SELECT id, 'HLB-BLK-10', '10', 'Black', 4, 200000 FROM products WHERE slug = 'heritage-leather-boot'
UNION ALL SELECT id, 'CSW-GRY-6', '6', 'Gray', 17, 0 FROM products WHERE slug = 'cloud-step-walker'
UNION ALL SELECT id, 'CSW-GRY-7', '7', 'Gray', 15, 0 FROM products WHERE slug = 'cloud-step-walker'
UNION ALL SELECT id, 'CSW-NVY-8', '8', 'Navy', 12, 0 FROM products WHERE slug = 'cloud-step-walker'
UNION ALL SELECT id, 'MSH-NVY-9', '9', 'Navy', 10, 0 FROM products WHERE slug = 'metro-suede-high'
UNION ALL SELECT id, 'MSH-NVY-10', '10', 'Navy', 8, 0 FROM products WHERE slug = 'metro-suede-high'
UNION ALL SELECT id, 'MSH-TAN-10', '10', 'Tan', 7, 0 FROM products WHERE slug = 'metro-suede-high'
UNION ALL SELECT id, 'RRC-BLK-6', '6', 'Black', 9, 0 FROM products WHERE slug = 'rain-ready-chelsea'
UNION ALL SELECT id, 'RRC-BLK-7', '7', 'Black', 11, 0 FROM products WHERE slug = 'rain-ready-chelsea'
UNION ALL SELECT id, 'RRC-GRN-8', '8', 'Green', 5, 0 FROM products WHERE slug = 'rain-ready-chelsea';
