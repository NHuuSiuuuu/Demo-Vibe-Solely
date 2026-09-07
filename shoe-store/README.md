# Shoe Store

Local shoe store MVP scaffold with a React + Vite client and Node.js/Express API.

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL client tools
- PostgreSQL with pgvector for the full RAG setup
- A PostgreSQL database URL in `server/.env` or exported as `DATABASE_URL`
- Optional: `OPENAI_API_KEY` in `server/.env` for AI-ranked product advice
- Optional: `GEMINI_API_KEY` in `server/.env` or deployment environment for RAG embeddings and grounded answers

If `DATABASE_URL` is not set, the API starts with an in-memory demo
database loaded from `database/schema.sql` and `database/seed.sql`. This
is useful for quick local review, but data resets when the server restarts.
If `OPENAI_API_KEY` is not set, product advice still works with the
backend's local filtered fallback response.
Do not commit Gemini or OpenAI keys. Gemini keys belong only in
`server/.env` for local development or in the backend deployment
environment; the frontend must never receive or store `GEMINI_API_KEY`.
When `GEMINI_API_KEY` is missing, RAG stays in a degraded/unconfigured
state: admin RAG checks can show setup gaps and customer chat receives a
graceful fallback response instead of grounded Gemini answers.

## Local URLs

- Frontend: http://161.248.81.90:5173
- Backend: http://161.248.81.90:5000

## Demo Accounts

- Admin: admin@shoestore.local / Admin123!
- Customer: customer@shoestore.local / Customer123!

## Setup

```bash
cd shoe-store
npm install
cp server/.env.example server/.env
```

Edit `server/.env` for local backend configuration. Use local-only
placeholder values first, then replace them outside git:

```env
DATABASE_URL=postgres://...
JWT_SECRET=...
GEMINI_API_KEY=your-gemini-api-key
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS=768
GEMINI_CHAT_MODEL=gemini-3.6-flash
RAG_TOP_K=6
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Never commit Gemini keys. Set secrets in `server/.env` locally and in
the deployment environment for production. The frontend must never
receive or store `GEMINI_API_KEY`. If `GEMINI_API_KEY` is empty, the
admin RAG page may show an unconfigured/degraded status and customers
will receive a graceful fallback response from chat.

To upload product images from the admin product form, configure the three
Cloudinary variables above in `server/.env`. The backend signs uploads, while
the browser sends image files directly to Cloudinary and stores only the
returned URL and public ID in PostgreSQL.

## VNPay Sandbox

Register a Sandbox merchant and obtain its `TmnCode` and hash secret from the
[VNPay Sandbox integration guide](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html).
Keep both values in the backend-only `server/.env`; never put them in a
frontend `VITE_*` variable or commit them.

VNPay sends its IPN from a remote server, so `localhost` is not a valid IPN
target. Start the backend on port `5000`, then expose it through a public HTTPS
tunnel. For example, after installing and authenticating either tunnel tool:

```bash
ngrok http 5000
# Alternative:
cloudflared tunnel --url http://localhost:5000
```

Copy the public HTTPS origin printed by the tunnel, such as
`https://solely-sandbox.example-tunnel.app`, and configure `server/.env` with
these exact variable names and placeholder values:

```env
VNPAY_HOST=https://sandbox.vnpayment.vn
VNPAY_TMN_CODE=your_sandbox_tmn_code
VNPAY_SECURE_SECRET=your_sandbox_hash_secret
VNPAY_RETURN_URL=https://solely-sandbox.example-tunnel.app/api/payments/vnpay/return
VNPAY_IPN_URL=https://solely-sandbox.example-tunnel.app/api/payments/vnpay/ipn
VNPAY_TEST_MODE=true
FRONTEND_URL=http://localhost:5173
```

`VNPAY_HOST` selects the Sandbox gateway; keep `VNPAY_TEST_MODE=true` as an
explicit environment marker. `VNPAY_RETURN_URL` receives the customer's browser
redirect, while `VNPAY_IPN_URL` receives the authoritative server-to-server
payment notification and therefore must remain publicly reachable over HTTPS.
`FRONTEND_URL` must be reachable by the browser because the backend return
handler redirects from there to `/payment-result`.

If the tunnel generates a new origin after restart, update both callback URLs,
update the Sandbox merchant configuration when required, and restart the
backend before creating another payment. Do not expose `server/.env`, the hash
secret, or a real callback query in logs, screenshots, issues, or commits.

### VNPay end-to-end checklist

Prepare a customer account, a product variant with known base price and a
non-zero `discountPercent`, enough stock for separate COD and VNPay orders, the
running app, and the HTTPS tunnel above.

- [ ] **Discount pricing:** confirm the product detail, cart, checkout, and
  persisted order item all use the same discounted unit price:
  `basePrice * (1 - discountPercent / 100)`, rounded to the nearest whole VND
  đồng by the backend (half đồng rounds up). Multiply this rounded unit price
  by quantity; do not round the unrounded line total instead.
- [ ] **COD:** create a fresh cart, choose COD, and confirm checkout creates one
  order without a gateway redirect; the order shows payment method `cod`,
  payment status `unpaid`, and the discounted totals.
- [ ] **VNPay URL:** create another fresh cart, choose VNPay, and confirm the
  order starts with payment method `vnpay` and payment status `pending`, then
  redirects to the signed Sandbox path
  `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`.
- [ ] **Successful IPN:** complete one Sandbox payment successfully and confirm
  the tunnel receives `GET /api/payments/vnpay/ipn`, the response contains
  `RspCode: "00"`, and the matching order becomes `paid` with the reconciled
  transaction number and amount stored on its database row. Confirm
  `/payment-result` reads that status from the order API rather than trusting
  Return URL query text.
- [ ] **Failed IPN:** use a separate VNPay order and a signed failed Sandbox
  callback; confirm the endpoint acknowledges it and the matching order becomes
  `failed`, never `paid`.
- [ ] **Repeated IPN:** replay the exact same signed IPN request from the tunnel
  inspector. Confirm the repeat is acknowledged with `RspCode: "00"`, the order
  remains in its terminal payment state, and stock/cart/order data receive no
  additional mutation.

Set up the database and start the app:

```bash
npm run db:setup
npm run dev
```

For an existing database, apply both additive migrations before starting the
updated server. The runner invokes the catalog migration first, then the
VNPay/discount migration, with `psql -v ON_ERROR_STOP=1`. It exits unsuccessfully
on SQL or process failures. Both migrations may be rerun:

```bash
npm run db:migrate
```

### Payment lifecycle and resume policy

Payment URLs include signed `vnp_CreateDate` and `vnp_ExpireDate` in GMT+7,
with a 15-minute payment window, as required by the
[official VNPay request contract](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html).
The expiry is part of the same sorted, once-encoded HMAC-SHA512 payload.
URL expiry does not prove payment failure: a delayed valid IPN is still
reconciled against the stored order and amount.

VNPay orders must be `paid` before an admin may move them to `shipping` or
`completed`. Cancellation is blocked for both `pending` and `paid` VNPay
payments. Pending orders keep their stock reservation until an authoritative
IPN resolves payment; a failed payment may then be cancelled to restore stock
once. Paid cancellation requires refund support, which this app does not
implement. A missing IPN therefore leaves an order pending and its stock
reserved; URL expiry alone never releases stock. COD transitions are unchanged.

An authenticated customer can `POST /api/orders/:id/payment-url` for their
existing VNPay order when payment is `pending` and the order is `pending` or
`confirmed`. The response is `{ "paymentUrl": "https://..." }`. The order
detail page exposes **Tiếp tục thanh toán VNPay** for these orders. The endpoint
locks the order, signs a fresh 15-minute URL using its persisted amount and
the same `vnp_TxnRef`, and makes no changes to orders, stock, items or cart.
This resumes the existing merchant payment reference; it does not create a
second payment attempt. Repeated calls in the same second may return the same
URL. Already paid/failed payments, COD, cancelled and fulfilled orders cannot
resume. Return URL status remains informational; only IPN changes payment state.

### Pricing migration and historical context

New variants use percentage pricing. Migration retains `legacy_price_delta`
for audit and explicitly marks unconverted rows with `legacy_pricing_active`.
Fallback applies only to those marked rows with a zero discount. Any explicit
admin `discountPercent` write, including `0`, permanently clears the marker;
stock-only edits keep it intact, and rerunning migration cannot reactivate it.
Preexisting zero discounts cannot retrospectively be distinguished from an
untouched migrated row. To explicitly set zero after upgrading, edit the
discount field (for example, clear it and enter `0`) and save. The admin form
omits untouched discount fields when saving existing variants, so a stock-only
save preserves active legacy pricing.

Catalog filters/sorts, variant sale prices, cart unit prices, new order unit
prices and line/order totals use whole đồng. Raw base-price audit context and
percentage precision are retained. Existing historical order amounts are
preserved, including any fractions saved before this fix. Cart items expose
`basePrice` and `discountPercent`; new order items snapshot both alongside
`unitPrice` and `lineTotal`, and customer/admin reads use these snapshots.
Migrated historical items return `null` for unknown context instead of using
the current catalog price. Refresh the RAG index after migration to update
previously stored pricing text.

For quick UI review without PostgreSQL, skip `server/.env` and
`npm run db:setup`, then run:

```bash
npm run dev
```

## Scripts

```bash
npm run dev
npm test
npm run build
npm run db:setup
```

- Health check: `GET /api/health`

## RAG Admin Workflow

The Gemini/RAG integration stores product and policy knowledge in
PostgreSQL tables backed by pgvector embeddings. After `npm run db:setup`
has created the schema and seeded local data, sign in with the demo admin
account and open `/admin/rag`.

From the "Kho tri thức AI" page, admins can:

- Review the overview counters for policy documents, active chunks and
  entries that need reindexing.
- Create or edit policy documents such as returns, shipping, warranty,
  terms and size guidance.
- Reindex one document after changing its content, or run a full reindex
  after product/catalog changes.
- Test grounded answers with prompts such as `Shop đổi trả thế nào?`.

Customer chat at `/api/ai/chat` uses the same RAG context. With Gemini
configured and the RAG tables indexed, a prompt such as `giày leo núi nam
dưới 3 triệu` should return trail/outdoor products and sources from the
knowledge base.

### Tìm sản phẩm bằng hình ảnh

Catalog hỗ trợ tìm giày bằng embedding ảnh trực tiếp với Gemini
`gemini-embedding-2`. Ảnh sản phẩm được index vào bảng
`product_image_embeddings`, tách riêng khỏi RAG văn bản, với vector 768
chiều và truy vấn bằng pgvector.

- Ở ô tìm kiếm sản phẩm, bấm biểu tượng camera để chọn ảnh từ máy hoặc mở
  camera sau trên điện thoại.
- Chỉ nhận JPEG/PNG tối đa 8 MB; ảnh truy vấn không được lưu lại.
- Các bộ lọc thương hiệu, giới tính, size, màu và khoảng giá được áp dụng
  cùng truy vấn ảnh.
- Admin xem trạng thái tại `/admin/rag`, có thể reindex toàn bộ ảnh hoặc
  reindex theo ID sản phẩm.

Nếu Gemini hoặc pgvector chưa cấu hình, catalog vẫn hoạt động với tìm kiếm
văn bản; chức năng tìm bằng ảnh sẽ trả lỗi cấu hình an toàn và không làm lộ
API key.
