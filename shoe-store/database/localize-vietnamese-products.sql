UPDATE users
SET first_name = 'Quản trị', last_name = 'Solely'
WHERE email = 'admin@shoestore.local';

UPDATE users
SET first_name = 'Khách hàng', last_name = 'Demo'
WHERE email = 'customer@shoestore.local';

INSERT INTO rag_documents (title, slug, document_type, content, status)
VALUES
  ('Cách đặt hàng', 'cach-dat-hang', 'ordering', 'Khách hàng chọn sản phẩm, chọn size và màu còn hàng, thêm vào giỏ rồi kiểm tra lại số lượng trước khi checkout. Khi đặt hàng COD, hãy nhập đúng họ tên, số điện thoại, email và địa chỉ nhận hàng để Solely xác nhận đơn. Sau khi đơn được tạo, khách có thể theo dõi trạng thái trong lịch sử đơn hàng.', 'active'),
  ('Thanh toán COD', 'thanh-toan-cod', 'payment', 'Solely hỗ trợ thanh toán khi nhận hàng bằng COD. Khách không cần chuyển khoản trước trong flow mặc định. Nhân viên giao hàng thu đúng tổng tiền hiển thị trên đơn, gồm tiền sản phẩm và phí vận chuyển nếu có. Nếu cần đổi thông tin thanh toán, khách nên liên hệ Solely trước khi đơn chuyển sang trạng thái đang giao.', 'active'),
  ('Vận chuyển', 'van-chuyen', 'shipping', 'Solely xử lý đơn sau khi xác nhận thông tin nhận hàng. Thời gian giao dự kiến phụ thuộc khu vực, tồn kho và lịch của đơn vị vận chuyển. Khách nên kiểm tra kỹ địa chỉ, số điện thoại và ghi chú giao hàng. Khi đơn đã chuyển sang đang giao, việc đổi địa chỉ có thể bị hạn chế.', 'active'),
  ('Đổi trả', 'doi-tra', 'returns', 'Khách có thể yêu cầu đổi trả khi sản phẩm còn nguyên tình trạng, chưa sử dụng ngoài phạm vi thử size trong nhà và còn đầy đủ hộp, tem, phụ kiện đi kèm. Các yêu cầu đổi size hoặc lỗi giao nhầm cần gửi kèm mã đơn, ảnh sản phẩm và mô tả vấn đề để Solely kiểm tra nhanh hơn.', 'active'),
  ('Bảo hành', 'bao-hanh', 'warranty', 'Solely hỗ trợ bảo hành cho lỗi sản xuất được xác nhận trong quá trình sử dụng thông thường. Chính sách không áp dụng cho hao mòn tự nhiên, sử dụng sai mục đích, va chạm mạnh, tự sửa chữa hoặc bảo quản không đúng cách. Khách cần cung cấp mã đơn và hình ảnh lỗi để được hướng dẫn.', 'active'),
  ('Hướng dẫn chọn size', 'huong-dan-chon-size', 'size_guide', 'Khách nên đo chiều dài bàn chân vào cuối ngày, mang loại tất thường dùng và so sánh với bảng size của từng mẫu. Nếu chân bè hoặc thích mang thoải mái, cân nhắc tăng nửa size hoặc chọn form rộng. Với giày chạy bộ và trekking, nên chừa khoảng trống nhẹ ở mũi chân để giảm cấn khi di chuyển lâu.', 'active'),
  ('Điều khoản mua hàng', 'dieu-khoan-mua-hang', 'terms', 'Khi đặt hàng tại Solely, khách đồng ý cung cấp thông tin chính xác để xử lý đơn, nhận hàng và hỗ trợ sau bán. Giá bán, tồn kho và chương trình khuyến mãi có thể thay đổi theo thời điểm. Solely có quyền liên hệ xác nhận hoặc từ chối đơn bất thường, sai thông tin hoặc không đáp ứng điều kiện mua hàng.', 'active')
ON CONFLICT (slug) DO UPDATE
SET title = EXCLUDED.title,
    document_type = EXCLUDED.document_type,
    content = EXCLUDED.content,
    status = EXCLUDED.status,
    updated_at = NOW();

WITH product_data(slug, name, description, brand, category, gender, base_price, featured) AS (
  VALUES
    ('urban-runner-knit', 'Solely Air Knit', 'Mục đích: chạy bộ hằng ngày, đi bộ nhanh và mang cả ngày. Chất liệu knit thoáng khí, đệm foam êm, form ôm vừa chân. Phù hợp người cần giày nhẹ cho đường nhựa, văn phòng năng động và lịch tập nhẹ.', 'Solely', 'running', 'unisex', 1890000, true),
    ('court-classic-low', 'Solely Court Low', 'Mục đích: sneaker trắng tối giản cho đi học, đi làm và phối đồ hằng ngày. Da tổng hợp dễ vệ sinh, đế cao su bền, độ bám ổn trên nền phố. Phù hợp khách muốn một đôi gọn, sạch và dễ mặc.', 'Solely', 'sneakers', 'unisex', 1590000, true),
    ('trail-guard-pro', 'Solely Trail Guard', 'Mục đích: trekking cuối tuần, đi rừng nhẹ và đường mòn khô. Độ bám cao, mũi giày gia cố, thân giày chắc và đệm vừa phải để giữ ổn định. Phù hợp khách hỏi giày leo núi, trail hoặc outdoor.', 'Solely', 'trail', 'men', 2490000, false),
    ('studio-flex-slip-on', 'Solely Studio Slip-On', 'Mục đích: tập gym nhẹ, yoga, đi bộ ngắn và di chuyển nhanh trong ngày. Thân slip-on co giãn, đệm mềm, form rộng thoải mái. Phù hợp nữ cần giày dễ xỏ, nhẹ chân, không ưu tiên chạy dài.', 'Solely', 'training', 'women', 1390000, false),
    ('heritage-leather-boot', 'Solely Leather Boot', 'Mục đích: đi làm, đi chơi cuối tuần và phối đồ smart casual. Da phủ mềm, cổ đệm êm, đế cao su bám chắc khi trời se lạnh. Phù hợp khách nam cần boot bền, lịch sự, không dùng cho leo núi kỹ thuật.', 'Solely', 'boots', 'men', 3290000, true),
    ('cloud-step-walker', 'Solely Cloud Walker', 'Mục đích: đi bộ nhiều, du lịch, đứng lâu và sinh hoạt hằng ngày. Đệm foam mềm, form rộng, cổ giày êm để giảm mỏi bàn chân. Phù hợp khách ưu tiên sự thoải mái hơn tốc độ hoặc phong cách thể thao mạnh.', 'Solely', 'walking', 'women', 1790000, false),
    ('metro-suede-high', 'Solely Suede High', 'Mục đích: sneaker cổ cao cho streetwear, đi học và đi chơi. Chất liệu suede mềm, cổ giày nâng đỡ nhẹ, đế phẳng ổn định. Phù hợp khách muốn phong cách nổi bật, không phải lựa chọn tối ưu cho chạy bộ.', 'Solely', 'sneakers', 'men', 2090000, false),
    ('rain-ready-chelsea', 'Solely Chelsea Rain', 'Mục đích: đi mưa nhẹ, đi làm và di chuyển trong phố. Thân boot chống nước nhẹ, quai kéo tiện, đế vân bám trên nền ướt. Phù hợp khách cần giày lịch sự khi trời mưa, không dành cho trekking dài.', 'Solely', 'boots', 'women', 2990000, true),
    ('summit-grip-hiker', 'Solely Summit Grip', 'Mục đích: leo núi nhẹ, trekking dốc vừa và đường đá nhỏ. Đế gai sâu, gót khóa chắc, mũi chống va đập và upper chống bám bẩn. Phù hợp khách cần độ bám tốt hơn sneaker khi đi outdoor cuối tuần.', 'Solely', 'trail', 'unisex', 2790000, true),
    ('riverstone-trek-mid', 'Solely Riverstone Mid', 'Mục đích: đi rừng, trekking đường ẩm và cắm trại. Cổ mid hỗ trợ mắt cá, vật liệu chống nước nhẹ, đế bám bùn tốt. Phù hợp khách hỏi giày leo núi ổn định, cần bảo vệ chân hơn mẫu cổ thấp.', 'Solely', 'trail', 'men', 3090000, false),
    ('campus-comfort-knit', 'Solely Campus Knit', 'Mục đích: đi học, đi làm casual và đi chơi cả ngày. Knit mềm thoáng, đệm êm vừa, form dễ mang với tất mỏng. Phù hợp khách muốn sneaker nhẹ, giá dễ tiếp cận, ưu tiên thoải mái hơn chống nước.', 'Solely', 'sneakers', 'unisex', 1490000, true),
    ('gym-core-trainer', 'Solely Gym Core', 'Mục đích: tập gym, cardio nhẹ, squat cơ bản và lớp fitness. Đế phẳng ổn định, thân giày giữ chân chắc, đệm phản hồi vừa. Phù hợp khách cần giày training đa dụng, không chuyên cho chạy đường dài.', 'Solely', 'training', 'unisex', 1990000, true),
    ('tempo-racer-lite', 'Solely Tempo Lite', 'Mục đích: chạy bộ 5km, đi bộ nhanh và tập cardio ngoài trời. Đệm nhẹ, upper thoáng, đế chuyển bước linh hoạt. Phù hợp khách muốn giày chạy êm hơn sneaker thường nhưng không cần carbon plate.', 'Solely', 'running', 'men', 2290000, false),
    ('commute-water-repel', 'Solely Commute Guard', 'Mục đích: đi làm hằng ngày, di chuyển xe máy và gặp mưa nhẹ. Bề mặt phủ kháng nước, đế bám nền ướt, form gọn dễ phối quần dài. Phù hợp khách cần sneaker sạch, thực dụng, không quá thể thao.', 'Solely', 'sneakers', 'unisex', 2190000, false),
    ('office-soft-loafer', 'Solely Office Soft', 'Mục đích: đi làm văn phòng, gặp khách và di chuyển ít trong ngày. Thân giả da mềm, lót êm, form lịch sự nhưng nhẹ hơn giày tây. Phù hợp khách cần đôi giày nhã nhặn, không dùng cho vận động mạnh.', 'Solely', 'walking', 'men', 1890000, false),
    ('court-flex-tennis', 'Solely Court Flex', 'Mục đích: tennis phong trào, pickleball và vận động ngang trên mặt sân. Đế cao su bám sân, thân giày ôm chắc, hông giày gia cố. Phù hợp khách hỏi giày court, cần ổn định hơn running shoe.', 'Solely', 'tennis', 'women', 2390000, false),
    ('street-basket-high', 'Solely Basket High', 'Mục đích: bóng rổ phong trào và phối đồ cổ cao. Cổ giày đệm dày, đế bám sân trong nhà, thân giày giữ chân khi đổi hướng. Phù hợp khách cần hỗ trợ cổ chân, không dùng cho trekking hoặc chạy dài.', 'Solely', 'basketball', 'men', 2690000, true),
    ('recovery-slide-soft', 'Solely Recovery Slide', 'Mục đích: đi sau tập luyện, đi trong nhà, ra phố gần và phục hồi bàn chân. Đệm EVA mềm, quai ôm nhẹ, đế chống trượt cơ bản. Phù hợp khách cần dép thể thao êm, không thay thế giày chạy.', 'Solely', 'walking', 'unisex', 790000, false),
    ('monsoon-trail-shield', 'Solely Monsoon Trail', 'Mục đích: trekking trời ẩm, đường đất ướt và du lịch vùng núi. Upper kháng nước, đế gai bám tốt, lưỡi gà che bụi. Phù hợp khách cần giày trail chống trơn, ưu tiên an toàn hơn vẻ thời trang.', 'Solely', 'trail', 'women', 2890000, true),
    ('daily-suede-classic', 'Solely Daily Suede', 'Mục đích: đi chơi, cafe, đi học và phối đồ tối giản. Suede mềm, đế cao su phẳng, màu trung tính dễ phối. Phù hợp khách cần sneaker đẹp, êm vừa, không ưu tiên chống nước hay vận động cường độ cao.', 'Solely', 'sneakers', 'women', 1790000, true)
)
INSERT INTO products (slug, name, description, brand, category, gender, base_price, status, featured)
SELECT slug, name, description, brand, category, gender, base_price, 'active'::product_status, featured
FROM product_data
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    brand = EXCLUDED.brand,
    category = EXCLUDED.category,
    gender = EXCLUDED.gender,
    base_price = EXCLUDED.base_price,
    status = EXCLUDED.status,
    featured = EXCLUDED.featured,
    updated_at = NOW();

WITH image_data(slug, image_url, alt_text) AS (
  VALUES
    ('urban-runner-knit', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80', 'Giày Solely Air Knit màu xám đá và trắng'),
    ('court-classic-low', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80', 'Sneaker Solely Court Low màu trắng'),
    ('trail-guard-pro', 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=900&q=80', 'Giày địa hình Solely Trail Guard màu olive'),
    ('studio-flex-slip-on', 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=900&q=80', 'Giày tập Solely Studio Slip-On màu đen'),
    ('heritage-leather-boot', 'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?auto=format&fit=crop&w=900&q=80', 'Boot da Solely Leather Boot màu nâu'),
    ('cloud-step-walker', 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=80', 'Giày đi bộ Solely Cloud Walker màu xám'),
    ('metro-suede-high', 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=900&q=80', 'Sneaker cổ cao Solely Suede High màu xanh navy'),
    ('rain-ready-chelsea', 'https://images.unsplash.com/photo-1605408499391-6368c628ef42?auto=format&fit=crop&w=900&q=80', 'Chelsea boot Solely Chelsea Rain màu đen'),
    ('summit-grip-hiker', 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=900&q=80', 'Giày trekking Solely Summit Grip màu nâu đá'),
    ('riverstone-trek-mid', 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&w=900&q=80', 'Giày cổ mid Solely Riverstone Mid màu xám rêu'),
    ('campus-comfort-knit', 'https://images.unsplash.com/photo-1603808033192-082d6919d3e1?auto=format&fit=crop&w=900&q=80', 'Sneaker knit Solely Campus Knit màu kem'),
    ('gym-core-trainer', 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=900&q=80', 'Giày training Solely Gym Core màu đen trắng'),
    ('tempo-racer-lite', 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=900&q=80', 'Giày chạy Solely Tempo Lite màu xanh'),
    ('commute-water-repel', 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=900&q=80', 'Sneaker kháng nước Solely Commute Guard màu xám'),
    ('office-soft-loafer', 'https://images.unsplash.com/photo-1614253429340-98120bd6d753?auto=format&fit=crop&w=900&q=80', 'Giày văn phòng Solely Office Soft màu đen'),
    ('court-flex-tennis', 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=900&q=80', 'Giày tennis Solely Court Flex màu trắng xanh'),
    ('street-basket-high', 'https://images.unsplash.com/photo-1579338559194-a162d19bf842?auto=format&fit=crop&w=900&q=80', 'Giày bóng rổ Solely Basket High màu đỏ đen'),
    ('recovery-slide-soft', 'https://images.unsplash.com/photo-1622920799137-86c891159e44?auto=format&fit=crop&w=900&q=80', 'Dép thể thao Solely Recovery Slide màu đen'),
    ('monsoon-trail-shield', 'https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=900&q=80', 'Giày trail Solely Monsoon Trail màu xanh rêu'),
    ('daily-suede-classic', 'https://images.unsplash.com/photo-1521093470119-a3acdc43374a?auto=format&fit=crop&w=900&q=80', 'Sneaker suede Solely Daily Suede màu be')
)
UPDATE product_images
SET image_url = image_data.image_url,
    alt_text = image_data.alt_text
FROM products
JOIN image_data ON products.slug = image_data.slug
WHERE product_images.product_id = products.id
  AND product_images.sort_order = 1;

WITH image_data(slug, image_url, alt_text) AS (
  VALUES
    ('urban-runner-knit', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80', 'Giày Solely Air Knit màu xám đá và trắng'),
    ('court-classic-low', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80', 'Sneaker Solely Court Low màu trắng'),
    ('trail-guard-pro', 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=900&q=80', 'Giày địa hình Solely Trail Guard màu olive'),
    ('studio-flex-slip-on', 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=900&q=80', 'Giày tập Solely Studio Slip-On màu đen'),
    ('heritage-leather-boot', 'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?auto=format&fit=crop&w=900&q=80', 'Boot da Solely Leather Boot màu nâu'),
    ('cloud-step-walker', 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=80', 'Giày đi bộ Solely Cloud Walker màu xám'),
    ('metro-suede-high', 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=900&q=80', 'Sneaker cổ cao Solely Suede High màu xanh navy'),
    ('rain-ready-chelsea', 'https://images.unsplash.com/photo-1605408499391-6368c628ef42?auto=format&fit=crop&w=900&q=80', 'Chelsea boot Solely Chelsea Rain màu đen'),
    ('summit-grip-hiker', 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=900&q=80', 'Giày trekking Solely Summit Grip màu nâu đá'),
    ('riverstone-trek-mid', 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&w=900&q=80', 'Giày cổ mid Solely Riverstone Mid màu xám rêu'),
    ('campus-comfort-knit', 'https://images.unsplash.com/photo-1603808033192-082d6919d3e1?auto=format&fit=crop&w=900&q=80', 'Sneaker knit Solely Campus Knit màu kem'),
    ('gym-core-trainer', 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=900&q=80', 'Giày training Solely Gym Core màu đen trắng'),
    ('tempo-racer-lite', 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=900&q=80', 'Giày chạy Solely Tempo Lite màu xanh'),
    ('commute-water-repel', 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=900&q=80', 'Sneaker kháng nước Solely Commute Guard màu xám'),
    ('office-soft-loafer', 'https://images.unsplash.com/photo-1614253429340-98120bd6d753?auto=format&fit=crop&w=900&q=80', 'Giày văn phòng Solely Office Soft màu đen'),
    ('court-flex-tennis', 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=900&q=80', 'Giày tennis Solely Court Flex màu trắng xanh'),
    ('street-basket-high', 'https://images.unsplash.com/photo-1579338559194-a162d19bf842?auto=format&fit=crop&w=900&q=80', 'Giày bóng rổ Solely Basket High màu đỏ đen'),
    ('recovery-slide-soft', 'https://images.unsplash.com/photo-1622920799137-86c891159e44?auto=format&fit=crop&w=900&q=80', 'Dép thể thao Solely Recovery Slide màu đen'),
    ('monsoon-trail-shield', 'https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=900&q=80', 'Giày trail Solely Monsoon Trail màu xanh rêu'),
    ('daily-suede-classic', 'https://images.unsplash.com/photo-1521093470119-a3acdc43374a?auto=format&fit=crop&w=900&q=80', 'Sneaker suede Solely Daily Suede màu be')
)
INSERT INTO product_images (product_id, image_url, alt_text, sort_order)
SELECT products.id, image_data.image_url, image_data.alt_text, 1
FROM products
JOIN image_data ON products.slug = image_data.slug
WHERE NOT EXISTS (
  SELECT 1
  FROM product_images
  WHERE product_images.product_id = products.id
    AND product_images.sort_order = 1
);

WITH variant_data(slug, sku, size, color, stock_quantity, discount_percent) AS (
  VALUES
    ('urban-runner-knit', 'URK-SLT-8', '8', 'Slate', 14, 0), ('urban-runner-knit', 'URK-WHT-9', '9', 'White', 9, 0),
    ('court-classic-low', 'CCL-WHT-7', '7', 'White', 20, 0), ('court-classic-low', 'CCL-BLK-9', '9', 'Black', 11, 0),
    ('trail-guard-pro', 'TGP-OLV-10', '10', 'Olive', 7, 0), ('trail-guard-pro', 'TGP-GRY-10', '10', 'Gray', 5, 0),
    ('studio-flex-slip-on', 'SFS-BLK-6', '6', 'Black', 15, 0), ('studio-flex-slip-on', 'SFS-SND-8', '8', 'Sand', 10, 0),
    ('heritage-leather-boot', 'HLB-BRN-10', '10', 'Brown', 8, 0), ('heritage-leather-boot', 'HLB-BLK-10', '10', 'Black', 4, 0),
    ('cloud-step-walker', 'CSW-GRY-6', '6', 'Gray', 17, 0), ('cloud-step-walker', 'CSW-NVY-8', '8', 'Navy', 12, 0),
    ('metro-suede-high', 'MSH-NVY-9', '9', 'Navy', 10, 0), ('metro-suede-high', 'MSH-TAN-10', '10', 'Tan', 7, 0),
    ('rain-ready-chelsea', 'RRC-BLK-6', '6', 'Black', 9, 0), ('rain-ready-chelsea', 'RRC-GRN-8', '8', 'Green', 5, 0),
    ('summit-grip-hiker', 'SGH-BRN-8', '8', 'Brown', 10, 0), ('summit-grip-hiker', 'SGH-GRY-10', '10', 'Gray', 8, 0),
    ('riverstone-trek-mid', 'RTM-MOS-10', '10', 'Moss', 7, 0), ('riverstone-trek-mid', 'RTM-BLK-11', '11', 'Black', 6, 0),
    ('campus-comfort-knit', 'CCK-CRM-7', '7', 'Cream', 18, 0), ('campus-comfort-knit', 'CCK-GRY-9', '9', 'Gray', 14, 0),
    ('gym-core-trainer', 'GCT-BLK-8', '8', 'Black', 13, 0), ('gym-core-trainer', 'GCT-WHT-10', '10', 'White', 10, 0),
    ('tempo-racer-lite', 'TRL-BLU-9', '9', 'Blue', 9, 0), ('tempo-racer-lite', 'TRL-GRN-10', '10', 'Green', 7, 0),
    ('commute-water-repel', 'CWR-GRY-8', '8', 'Gray', 12, 0), ('commute-water-repel', 'CWR-BLK-10', '10', 'Black', 11, 0),
    ('office-soft-loafer', 'OSL-BLK-9', '9', 'Black', 8, 0), ('office-soft-loafer', 'OSL-BRN-10', '10', 'Brown', 6, 0),
    ('court-flex-tennis', 'CFT-WHT-6', '6', 'White', 12, 0), ('court-flex-tennis', 'CFT-MNT-7', '7', 'Mint', 9, 0),
    ('street-basket-high', 'SBH-RED-9', '9', 'Red', 8, 0), ('street-basket-high', 'SBH-BLK-10', '10', 'Black', 7, 0),
    ('recovery-slide-soft', 'RSS-BLK-8', '8', 'Black', 20, 0), ('recovery-slide-soft', 'RSS-GRY-10', '10', 'Gray', 16, 0),
    ('monsoon-trail-shield', 'MTS-MOS-6', '6', 'Moss', 8, 0), ('monsoon-trail-shield', 'MTS-BLK-7', '7', 'Black', 7, 0),
    ('daily-suede-classic', 'DSC-BGE-6', '6', 'Beige', 15, 0), ('daily-suede-classic', 'DSC-ROS-7', '7', 'Rose', 10, 0)
)
INSERT INTO product_variants (product_id, sku, size, color, stock_quantity, discount_percent)
SELECT products.id, variant_data.sku, variant_data.size, variant_data.color, variant_data.stock_quantity, variant_data.discount_percent
FROM products
JOIN variant_data ON products.slug = variant_data.slug
ON CONFLICT (sku) DO UPDATE
SET size = EXCLUDED.size,
    color = EXCLUDED.color,
    stock_quantity = EXCLUDED.stock_quantity,
    discount_percent = EXCLUDED.discount_percent;
