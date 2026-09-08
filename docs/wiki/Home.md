# Solely Wiki

## Mục đích

Wiki này là bản tóm tắt vận hành của Solely, được đồng bộ từ `shoe-store/README.md`. Mỗi hệ thống hoặc tính năng mới phải cập nhật cả README và Wiki.

## Trạng thái hiện tại

- Catalog sản phẩm: hoàn thành.
- Tài khoản customer/admin và phân quyền: hoàn thành.
- Giỏ hàng, COD và theo dõi đơn hàng: hoàn thành.
- VNPay Sandbox, callback/IPN và hoàn tiền: đã triển khai; cần kiểm tra OTP và IPN qua tunnel public trước production.
- RAG Admin Gemini với pgvector: đã triển khai.
- Chat tư vấn sản phẩm/chính sách: đã triển khai, Gemini chạy backend-only.
- Tìm kiếm bằng hình ảnh: đã triển khai; cần xác minh live đầy đủ khi Gemini và pgvector sẵn sàng.
- Autocomplete tìm kiếm sản phẩm trên header: đã triển khai.

## Kiểm thử gần nhất

- E2E PostgreSQL thật customer/admin: 96/96 pass.
- Kiểm thử hardening và phân quyền: 25/25 pass.
- Client tests: 86/86 pass.
- Production build: pass.
- Server test suite còn các failure do PGlite không hỗ trợ kiểu `vector`; cần xử lý test adapter hoặc chạy bộ test trên PostgreSQL thật.

## Chạy dự án

Xem hướng dẫn đầy đủ tại [`shoe-store/README.md`](../../shoe-store/README.md).

```bash
cd shoe-store
npm install
npm run db:setup
npm run dev
```

## Quy tắc cập nhật tài liệu

Sau mỗi hệ thống hoặc tính năng mới:

1. Cập nhật README với cách dùng, trạng thái, giới hạn và kế hoạch tiếp theo.
2. Cập nhật trang Wiki tương ứng từ nội dung README.
3. Ghi thay đổi vào `CHANGELOG.md` bằng tiếng Việt.
4. Chạy test/build phù hợp và ghi kết quả kiểm chứng.

## Kế hoạch tiếp theo

- Hoàn tất kiểm thử VNPay Sandbox bằng OTP và IPN qua HTTPS tunnel.
- Xử lý test adapter PGlite/pgvector để server test không còn failure môi trường.
- Rotate Gemini API key đã từng xuất hiện trong hội thoại trước khi triển khai production.
