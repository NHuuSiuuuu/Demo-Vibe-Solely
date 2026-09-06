# Backlog

File này ghi lại các việc nên làm tiếp sau MVP. Đây là danh sách ưu tiên, không phải phần bắt buộc để chạy bản hiện tại.

## Ưu Tiên Cao

- Thêm migration database an toàn để thay đổi schema mà không cần chạy lại `npm run db:setup`.
- Thêm upload ảnh sản phẩm thay cho ảnh placeholder.
- Thêm quản lý khách hàng trong admin, gồm xem thông tin khách và lịch sử đơn hàng.
- Thêm quy tắc hủy đơn cho khách hàng và admin.
- Thêm email thông báo khi đăng ký tài khoản và khi đơn hàng đổi trạng thái.
- Thêm cấu hình deploy production cho frontend, backend và managed PostgreSQL.

## Ưu Tiên Trung Bình

- Thêm đánh giá sản phẩm sau khi đơn hàng hoàn thành.
- Thêm mã giảm giá và chương trình khuyến mãi.
- Thêm sắp xếp sản phẩm theo giá, mới nhất, nổi bật và tình trạng tồn kho.
- Thêm thống kê admin cho doanh thu, sản phẩm bán chạy, sản phẩm sắp hết hàng và số lượng đơn theo trạng thái.
- Thêm lịch sử thay đổi trạng thái đơn hàng để dễ truy vết.
- Thêm phân trang cho danh sách sản phẩm, đơn hàng và các trang admin.

## Làm Sau

- Thêm thanh toán online bên cạnh COD.
- Thêm wishlist hoặc sản phẩm yêu thích.
- Thêm gợi ý sản phẩm dựa trên lịch sử xem và lịch sử mua hàng.
- Thêm import/export tồn kho bằng CSV.
- Thêm nhắn tin hỗ trợ khách hàng.
- Thêm monitoring, error tracking và tài liệu backup database.

## Nợ Kỹ Thuật

- Thay script setup có drop bảng bằng các lệnh migration và seed riêng.
- Thêm luồng setup test database riêng cho integration test chạy với PostgreSQL.
- Tách secret local development khỏi tài liệu chung và đưa vào hướng dẫn cấu hình theo môi trường.
- Thêm rate limiting API và cấu hình auth chặt hơn trước khi public production.
