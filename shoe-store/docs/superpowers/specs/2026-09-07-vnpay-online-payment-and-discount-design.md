# VNPay Online Payment and Variant Discount Design

## Goal

Cho phép khách hàng Solely thanh toán bằng VNPay Sandbox bên cạnh COD, đồng
thời thay cơ chế chênh lệch giá của phiên bản bằng phần trăm giảm giá nhất
quán trên toàn bộ hệ thống.

## Scope

### 1. Phần trăm giảm giá phiên bản

- Admin nhập `discountPercent` từ `0` đến `100` cho mỗi phiên bản.
- UI không còn hiển thị hoặc cho nhập `priceDelta`.
- Giá bán của một phiên bản được tính:

  `unitPrice = basePrice * (1 - discountPercent / 100)`

- Giá được làm tròn theo đơn vị đồng Việt Nam trước khi hiển thị, thêm vào
  giỏ hàng và ghi vào đơn hàng.
- Backend là nguồn tính giá cuối cùng; frontend không được tự quyết định tổng
  tiền để tạo đơn.
- Dữ liệu cũ phải được chuyển đổi có kiểm soát trong migration. Không âm thầm
  làm thay đổi giá các phiên bản đang bán nếu chưa có giá trị giảm giá tương
  đương.

### 2. VNPay Sandbox

- Checkout thêm lựa chọn `cod` và `vnpay`.
- COD giữ hành vi hiện tại: tạo đơn `unpaid`, phương thức `cod`.
- VNPay tạo đơn trước với phương thức `vnpay`, trạng thái thanh toán chờ xử
  lý và trạng thái đơn chờ xác nhận; backend trả URL thanh toán cho frontend.
- Frontend chuyển trình duyệt tới URL VNPay. Không đánh dấu thanh toán thành
  công từ kết quả điều hướng của frontend.
- Backend cung cấp hai endpoint:
  - `GET /api/payments/vnpay/return`: kiểm tra chữ ký và trả khách về frontend
    với kết quả hiển thị.
  - `GET /api/payments/vnpay/ipn`: kiểm tra chữ ký, kiểm tra mã đơn và số tiền,
    cập nhật trạng thái thanh toán; trả response chuẩn VNPay.
- IPN phải idempotent: gọi lại cùng một giao dịch không tạo đơn hoặc cập nhật
  sai trạng thái.
- Chỉ mã phản hồi thành công, đúng chữ ký, đúng mã giao dịch, đúng số tiền và
  đúng đơn hàng mới chuyển `payment_status` sang `paid`.
- Giao dịch hủy hoặc thất bại chuyển sang trạng thái thất bại/hủy thanh toán,
  không chuyển sang `paid`.
- Secret và mã website chỉ nằm ở backend environment.

## Database Design

- Thêm `discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0` vào
  `product_variants`.
- Giữ `price_delta` trong giai đoạn migration để dữ liệu cũ không mất; sau khi
  kiểm tra chuyển đổi, code mới không đọc hoặc ghi cột này. Việc xóa cột sẽ
  tách thành bước dọn dẹp riêng.
- Mở rộng phương thức thanh toán để có `vnpay`.
- Mở rộng trạng thái thanh toán để phân biệt `unpaid`, `pending`, `paid` và
  `failed`.
- Lưu mã giao dịch VNPay và dữ liệu đối soát cần thiết trên `orders`, gồm mã
  giao dịch, số tiền request và thời điểm cập nhật cuối.
- Đơn hàng vẫn lưu `unit_price` và `line_total` tại thời điểm checkout để giá
  lịch sử không thay đổi khi sản phẩm được cập nhật.

## Backend Components

- `variant pricing`: một helper dùng chung cho product detail, cart, checkout,
  order mapping và RAG product context.
- `vnpay client/service`: tạo query string theo chuẩn VNPay, ký HMAC-SHA512,
  kiểm tra chữ ký và xây URL return/IPN.
- `payments routes`: tạo payment URL, return và IPN; mọi cập nhật order dùng
  transaction và khóa bản ghi khi cần.
- `orders service`: tạo COD hoặc VNPay order, kiểm tra tồn kho và tổng tiền
  server-side trước khi tạo payment request.

## Frontend Behavior

- Checkout hiển thị radio/segmented choice `COD` và `VNPay`.
- Với COD, hiển thị nút `Đặt hàng COD`.
- Với VNPay, hiển thị nút `Thanh toán qua VNPay`; sau khi backend trả URL,
  chuyển hướng tới VNPay.
- Trang kết quả thanh toán đọc trạng thái từ backend, không tin query string
  nếu chưa được backend xác thực.
- Product detail, cart, checkout, orders và admin order detail đều dùng nhãn
  giảm giá và giá sau giảm thống nhất.

## Configuration

```env
VNPAY_HOST=https://sandbox.vnpayment.vn
VNPAY_TMN_CODE=your_tmn_code
VNPAY_SECURE_SECRET=your_secure_secret
VNPAY_RETURN_URL=http://localhost:5000/api/payments/vnpay/return
VNPAY_IPN_URL=http://localhost:5000/api/payments/vnpay/ipn
VNPAY_TEST_MODE=true
FRONTEND_URL=http://localhost:5173
```

URL IPN phải là URL backend mà VNPay Sandbox có thể gọi tới. Khi chạy local,
cần tunnel HTTPS công khai; `localhost` chỉ phù hợp cho return URL trên máy
khách, không phù hợp để VNPay gọi IPN.

## Error Handling

- Thiếu cấu hình VNPay: checkout trả lỗi JSON rõ ràng, không tạo payment URL.
- Sai chữ ký, sai số tiền, sai mã đơn hoặc đơn không tồn tại: từ chối cập nhật
  và ghi log an toàn không chứa secret.
- Giao dịch đã `paid`: IPN lặp lại trả thành công idempotent, không trừ tồn
  kho lần hai.
- VNPay lỗi sau khi đơn đã tạo: đơn giữ `pending`, cho phép khách thử lại theo
  chính sách retry, không tạo bản ghi order trùng ngoài chủ đích.
- Lỗi thanh toán không làm mất đơn hoặc làm sai tổng tiền đã lưu.

## Testing and Acceptance Criteria

- Unit test slug/discount pricing: `0%`, `10%`, `100%`, số thập phân, giá làm
  tròn và giá không âm.
- API test product detail/cart/checkout dùng giá sau giảm.
- API test tạo COD vẫn giữ hành vi hiện tại.
- API test VNPay tạo URL có đủ tham số và chữ ký.
- API test return/IPN từ chối chữ ký sai, sai số tiền và sai mã đơn.
- API test IPN thành công cập nhật đúng một lần và retry không nhân đôi.
- Frontend test chọn COD/VNPay, redirect đúng URL và hiển thị trạng thái.
- Migration test chạy được trên database cũ có `price_delta`.
- Chạy `npm test`, `npm run build` và `git diff --check` trước bàn giao.

## Out of Scope

- Thanh toán production thật.
- Hoàn tiền tự động qua VNPay.
- Thẻ quốc tế hoặc cổng thanh toán khác.
- Xóa ngay `price_delta` trong cùng lần triển khai nếu còn dữ liệu cũ phụ
  thuộc cột này.
