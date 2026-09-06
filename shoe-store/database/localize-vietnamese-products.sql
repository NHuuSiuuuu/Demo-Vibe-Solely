UPDATE users
SET first_name = 'Quản trị', last_name = 'Solely'
WHERE email = 'admin@shoestore.local';

UPDATE users
SET first_name = 'Khách hàng', last_name = 'Demo'
WHERE email = 'customer@shoestore.local';

UPDATE products
SET name = data.name,
    description = data.description,
    brand = data.brand,
    base_price = data.base_price
FROM (
  VALUES
    ('urban-runner-knit', 'Solely Air Knit', 'Giày chạy bộ hằng ngày nhẹ, thoáng khí và ôm chân êm ái.', 'Solely', 1890000),
    ('court-classic-low', 'Solely Court Low', 'Sneaker cổ thấp tinh gọn với lót êm và đế bền cho cả ngày.', 'Solely', 1590000),
    ('trail-guard-pro', 'Solely Trail Guard', 'Giày địa hình vững chắc với đế bám tốt và mũi giày gia cố.', 'Solely', 2490000),
    ('studio-flex-slip-on', 'Solely Studio Slip-On', 'Giày slip-on linh hoạt cho buổi tập nhẹ và những việc nhanh trong ngày.', 'Solely', 1390000),
    ('heritage-leather-boot', 'Solely Leather Boot', 'Boot da cao cấp với cổ đệm êm và đế cao su bám chắc.', 'Solely', 3290000),
    ('cloud-step-walker', 'Solely Cloud Walker', 'Giày đi bộ hỗ trợ tốt với đệm foam mềm và phom rộng thoải mái.', 'Solely', 1790000),
    ('metro-suede-high', 'Solely Suede High', 'Sneaker cổ cao bằng suede, đường chỉ tương phản và nâng đỡ cổ chân.', 'Solely', 2090000),
    ('rain-ready-chelsea', 'Solely Chelsea Rain', 'Chelsea boot chống nước nhẹ với quai kéo tiện lợi và đế vân bám.', 'Solely', 2990000)
) AS data(slug, name, description, brand, base_price)
WHERE products.slug = data.slug;

UPDATE product_images
SET image_url = data.image_url,
    alt_text = data.alt_text
FROM products
JOIN (
  VALUES
    ('urban-runner-knit', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80', 'Giày Solely Air Knit màu xám đá và trắng'),
    ('court-classic-low', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80', 'Sneaker Solely Court Low màu trắng'),
    ('trail-guard-pro', 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=900&q=80', 'Giày địa hình Solely Trail Guard màu olive'),
    ('studio-flex-slip-on', 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=900&q=80', 'Giày tập Solely Studio Slip-On màu đen'),
    ('heritage-leather-boot', 'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?auto=format&fit=crop&w=900&q=80', 'Boot da Solely Leather Boot màu nâu'),
    ('cloud-step-walker', 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=80', 'Giày đi bộ Solely Cloud Walker màu xám'),
    ('metro-suede-high', 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=900&q=80', 'Sneaker cổ cao Solely Suede High màu xanh navy'),
    ('rain-ready-chelsea', 'https://images.unsplash.com/photo-1605408499391-6368c628ef42?auto=format&fit=crop&w=900&q=80', 'Chelsea boot Solely Chelsea Rain màu đen')
) AS data(slug, image_url, alt_text) ON products.slug = data.slug
WHERE product_images.product_id = products.id
  AND product_images.sort_order = 1;

UPDATE product_variants
SET price_delta = data.price_delta
FROM (
  VALUES
    ('HLB-BLK-10', 200000)
) AS data(sku, price_delta)
WHERE product_variants.sku = data.sku;
