UPDATE users
SET first_name = 'Quản trị', last_name = 'Solely'
WHERE email = 'admin@shoestore.local';

UPDATE users
SET first_name = 'Khách hàng', last_name = 'Demo'
WHERE email = 'customer@shoestore.local';

UPDATE products
SET name = data.name,
    description = data.description,
    brand = data.brand
FROM (
  VALUES
    ('urban-runner-knit', 'Solely Air Knit', 'Giày chạy bộ hằng ngày nhẹ, thoáng khí và ôm chân êm ái.', 'Solely'),
    ('court-classic-low', 'Solely Court Low', 'Sneaker cổ thấp tinh gọn với lót êm và đế bền cho cả ngày.', 'Solely'),
    ('trail-guard-pro', 'Solely Trail Guard', 'Giày địa hình vững chắc với đế bám tốt và mũi giày gia cố.', 'Solely'),
    ('studio-flex-slip-on', 'Solely Studio Slip-On', 'Giày slip-on linh hoạt cho buổi tập nhẹ và những việc nhanh trong ngày.', 'Solely'),
    ('heritage-leather-boot', 'Solely Leather Boot', 'Boot da cao cấp với cổ đệm êm và đế cao su bám chắc.', 'Solely'),
    ('cloud-step-walker', 'Solely Cloud Walker', 'Giày đi bộ hỗ trợ tốt với đệm foam mềm và phom rộng thoải mái.', 'Solely'),
    ('metro-suede-high', 'Solely Suede High', 'Sneaker cổ cao bằng suede, đường chỉ tương phản và nâng đỡ cổ chân.', 'Solely'),
    ('rain-ready-chelsea', 'Solely Chelsea Rain', 'Chelsea boot chống nước nhẹ với quai kéo tiện lợi và đế vân bám.', 'Solely')
) AS data(slug, name, description, brand)
WHERE products.slug = data.slug;

UPDATE product_images
SET image_url = data.image_url,
    alt_text = data.alt_text
FROM products
JOIN (
  VALUES
    ('urban-runner-knit', 'https://placehold.co/900x700/png?text=Solely+Air+Knit', 'Giày Solely Air Knit màu xám đá và trắng'),
    ('court-classic-low', 'https://placehold.co/900x700/png?text=Solely+Court+Low', 'Sneaker Solely Court Low màu trắng'),
    ('trail-guard-pro', 'https://placehold.co/900x700/png?text=Solely+Trail+Guard', 'Giày địa hình Solely Trail Guard màu olive'),
    ('studio-flex-slip-on', 'https://placehold.co/900x700/png?text=Solely+Studio+Slip-On', 'Giày tập Solely Studio Slip-On màu đen'),
    ('heritage-leather-boot', 'https://placehold.co/900x700/png?text=Solely+Leather+Boot', 'Boot da Solely Leather Boot màu nâu'),
    ('cloud-step-walker', 'https://placehold.co/900x700/png?text=Solely+Cloud+Walker', 'Giày đi bộ Solely Cloud Walker màu xám'),
    ('metro-suede-high', 'https://placehold.co/900x700/png?text=Solely+Suede+High', 'Sneaker cổ cao Solely Suede High màu xanh navy'),
    ('rain-ready-chelsea', 'https://placehold.co/900x700/png?text=Solely+Chelsea+Rain', 'Chelsea boot Solely Chelsea Rain màu đen')
) AS data(slug, image_url, alt_text) ON products.slug = data.slug
WHERE product_images.product_id = products.id
  AND product_images.sort_order = 1;
