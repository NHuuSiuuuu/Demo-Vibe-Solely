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

### Đã thay đổi

- Thêm fallback database in-memory để review local khi chưa cấu hình `DATABASE_URL`.
- Cập nhật lớp truy cập database để backend chạy được với PostgreSQL thật hoặc demo fallback.
- Cải thiện phần admin chỉnh tồn kho biến thể sau vòng review implementation.

### Đã kiểm chứng

- Backend test suite đã pass trong quá trình triển khai MVP.
- Frontend test suite đã pass trong quá trình triển khai MVP.
- Frontend production build đã pass trong quá trình triển khai MVP.
- Kết nối PostgreSQL local đã được kiểm chứng bằng cách tạo customer qua API và đọc lại từ bảng `users`.

## 2026-09-05

### Đã thêm

- Viết spec thiết kế MVP cho flow cửa hàng giày có auth.
- Viết plan triển khai gồm scaffold, database, auth, product API, cart/orders, admin flow, AI advisor, frontend flow, verification và docs.
