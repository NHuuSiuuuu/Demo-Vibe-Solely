# Development Prompt

File này là nơi người dùng dán prompt/yêu cầu phát triển cho Solely.

## Cách dùng

1. Dán yêu cầu mới vào phần `Prompt của người dùng`.
2. Giữ lại các ràng buộc quan trọng trong phần `Quy định bắt buộc`.
3. Khi bắt đầu phát triển, coding agent phải đọc file này cùng `AGENTS.md`.
4. Sau khi hoàn tất thay đổi, cập nhật `CHANGELOG.md` theo rule trong `AGENTS.md`.

## Prompt của người dùng

<!-- Dán prompt/yêu cầu phát triển vào bên dưới dòng này. -->


## Mục tiêu

<!-- Mô tả kết quả cuối cùng cần đạt được. -->


## Phạm vi

<!-- Ghi rõ phần nào được sửa và phần nào không được đụng. -->


## Quy định bắt buộc

- Giữ stack React, Vite, Node.js, Express và PostgreSQL.
- Giữ auth JWT với role `customer` và `admin`.
- Không tự merge vào `main` nếu chưa có lệnh rõ từ người dùng.
- Không revert thay đổi ngoài phạm vi yêu cầu.
- Mọi thay đổi phải được ghi vào `CHANGELOG.md` bằng tiếng Việt.

## Kiểm chứng mong muốn

<!-- Ghi test/build/smoke test cần chạy nếu có yêu cầu cụ thể. -->


## Ghi chú

<!-- Ghi thêm thông tin thiết kế, link tham khảo, tài khoản demo hoặc production caveat nếu cần. -->
