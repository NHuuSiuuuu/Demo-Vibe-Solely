# Changelog

File này ghi lại các thay đổi quan trọng của dự án để dễ theo dõi phần sản phẩm, code, database và triển khai sau này.

## Chưa phát hành

### Đã thêm

- Tạo MVP cửa hàng giày bằng React, Vite, Node.js, Express và hỗ trợ PostgreSQL.
- Thêm đăng ký/đăng nhập bằng email và mật khẩu, JWT session, phân quyền `customer` và `admin`.
- Thêm danh sách sản phẩm, trang chi tiết sản phẩm, tìm kiếm, bộ lọc, ảnh sản phẩm, size, màu và biến thể có tồn kho.
- Thêm giỏ hàng, checkout COD, tạo đơn hàng, lịch sử đơn hàng của khách và trang chi tiết đơn.
- Thêm dashboard admin để quản lý sản phẩm, biến thể, tồn kho và trạng thái đơn hàng.
- Thêm AI tư vấn sản phẩm dựa trên dữ liệu catalog, có fallback khi chưa cấu hình OpenAI API key.
- Thêm schema và seed database cho users, products, product images, variants, carts, orders, order items và AI chat messages.
- Thêm tài liệu setup local và tài khoản demo.
- Cài và cấu hình PostgreSQL local trên remote development server.
- Thêm script `database/localize-vietnamese-products.sql` để cập nhật dữ liệu sản phẩm PostgreSQL thật sang bộ sản phẩm Solely tiếng Việt mà không reset database.
- Thêm ảnh sản phẩm thật từ `images.unsplash.com` cho bộ sản phẩm Solely, thay cho ảnh placeholder.
- Thêm giao diện storefront phong cách editorial tối giản cho Solely, gồm hero carousel, hàng mới về, banner ưu đãi, bento sản phẩm bán chạy, Solely Journal, Instagram strip và footer nền tối.
- Thêm giao diện chi tiết sản phẩm mới với breadcrumb, đánh giá, quantity stepper, nút mua ngay, danh sách review và carousel sản phẩm liên quan.
- Thêm component `ImageStreamHero` cho hero trang Home với hiệu ứng hai luồng ảnh sneaker chạy theo chiều sâu/perspective.

### Đã thay đổi

- Thêm fallback database in-memory để review local khi chưa cấu hình `DATABASE_URL`.
- Cập nhật lớp truy cập database để backend chạy được với PostgreSQL thật hoặc demo fallback.
- Cải thiện phần admin chỉnh tồn kho biến thể sau vòng review implementation.
- Việt hóa toàn bộ giao diện khách hàng và admin: auth, giỏ hàng, checkout, đơn hàng, trạng thái, quản lý sản phẩm, quản lý đơn và AI assistant.
- Redesign storefront theo hướng thương hiệu Solely premium sneaker: header sticky, hero, trust bar, product grid, filter danh mục, banner chất liệu, story, newsletter và footer.
- Cập nhật metadata gốc của frontend sang `lang="vi"` và title Solely.
- Cập nhật seed database sang dữ liệu sản phẩm Solely tiếng Việt.
- Bổ sung icon bằng `lucide-react` cho các thành phần UI chính.
- Chuyển toàn bộ hiển thị tiền từ USD sang VND, bỏ số lẻ thập phân.
- Cập nhật giá sản phẩm/biến thể trong seed và script cập nhật PostgreSQL sang mức giá VND phù hợp shop giày Việt Nam.
- Cập nhật input giá trong admin theo bước VND `1000`.
- Áp phong cách từ prompt furniture editorial vào shop giày Solely nhưng giữ nguyên domain shop giày Việt, sản phẩm sneaker, giá VND và nghiệp vụ hiện có.
- Cập nhật hover card ảnh sản phẩm, CTA terracotta, typography uppercase, divider mảnh, responsive grid và header hamburger cho mobile.
- Thay ảnh hero tĩnh bằng corridor image stream có hỗ trợ reduced motion và vẫn giữ điều hướng slide bằng nút/dot.
- Tinh chỉnh hero image stream gần demo hơn: tăng mật độ lên 12 card mỗi rail, đặt nội dung giữa màn hình và làm luồng ảnh nổi rõ hơn.

### Đã kiểm chứng

- Backend test suite đã pass trong quá trình triển khai MVP.
- Frontend test suite đã pass trong quá trình triển khai MVP.
- `npm test` đã pass sau bản Việt hóa/redesign: server 52/52, client 20/20.
- `npm run build` đã pass sau bản Việt hóa/redesign.
- `git diff --check` đã pass sau bản Việt hóa/redesign.
- Kết nối PostgreSQL local đã được kiểm chứng bằng cách tạo customer qua API và đọc lại từ bảng `users`.
- API products đã được kiểm chứng trả dữ liệu Solely tiếng Việt từ PostgreSQL thật.
- Thêm test bắt buộc UI hiển thị VND thay vì USD trong customer/admin flow.
- Thêm test bắt buộc seed dùng giá VND-scale và không còn ảnh placeholder.
- Thêm test cho homepage editorial carousel và trang chi tiết sản phẩm có quantity stepper/nút mua ngay.
- Thêm test bắt buộc homepage render hiệu ứng image stream trong hero.

## 2026-09-05

### Đã thêm

- Viết spec thiết kế MVP cho flow cửa hàng giày có auth.
- Viết plan triển khai gồm scaffold, database, auth, product API, cart/orders, admin flow, AI advisor, frontend flow, verification và docs.
