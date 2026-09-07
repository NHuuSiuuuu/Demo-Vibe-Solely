# VNPay Online Payment and Variant Discount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm thanh toán VNPay Sandbox và thay trường chênh lệch giá phiên bản bằng phần trăm giảm giá xuyên suốt Solely.

**Architecture:** Tách helper tính giá dùng chung cho product, cart, order và RAG. Backend tạo đơn và payment request VNPay, xác thực chữ ký ở return/IPN trong transaction; frontend chỉ chọn phương thức và redirect tới URL backend trả về. Migration giữ cột giá legacy để không làm thay đổi giá cũ ngoài ý muốn.

**Tech Stack:** React, Vite, Node.js, Express, PostgreSQL, `pg`, `crypto` chuẩn Node, VNPay Sandbox.

**Spec:** `docs/superpowers/specs/2026-09-07-vnpay-online-payment-and-discount-design.md`

## Global Constraints

- Backend là nguồn duy nhất tính giá, tổng tiền và xác nhận thanh toán.
- Chỉ IPN/return có chữ ký VNPay hợp lệ, đúng mã đơn và đúng số tiền mới được đánh dấu `paid`.
- Không commit `VNPAY_SECURE_SECRET` hoặc bất kỳ API key nào.
- Mọi thay đổi phải ghi tiếng Việt vào `CHANGELOG.md`.
- Mỗi task phải có test đỏ trước implementation và test xanh sau implementation.

### Task 1: Database Pricing and VNPay Schema

**Files:**
- Modify: `database/schema.sql`
- Create: `database/migrations/20260907-vnpay-discount.sql`
- Modify: `server/test/database-files.test.js`
- Create: `server/test/payment-schema.test.js`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces `product_variants.discount_percent` and legacy price compatibility.
- Produces `orders.payment_method = 'vnpay'`, payment statuses `pending` and `failed`, plus VNPay transaction fields.

- [ ] **Step 1: Write failing schema tests** for `discount_percent`, VNPay enum values, `vnpay_transaction_no`, `vnpay_amount` and `vnpay_updated_at`.
- [ ] **Step 2: Run the focused schema tests** and confirm they fail because the fields and enum values do not exist.
- [ ] **Step 3: Update fresh schema.** Replace fresh variant pricing input with `discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0` and retain no user-facing `price_delta`. Add VNPay method/status values and order reconciliation columns.
- [ ] **Step 4: Write additive migration.** Rename existing `price_delta` to `legacy_price_delta`, add `discount_percent`, preserve old rows through a legacy fallback, add enum values with `ALTER TYPE ... ADD VALUE IF NOT EXISTS`-compatible guarded SQL, and add order columns with `ADD COLUMN IF NOT EXISTS`.
- [ ] **Step 5: Run migration against a copy/test database** containing the old schema and verify it can be applied twice without destructive statements.
- [ ] **Step 6: Run focused schema tests** and commit `feat: add discount and vnpay database schema`.

### Task 2: Shared Variant Price Calculation

**Files:**
- Create: `server/src/modules/products/pricing.js`
- Modify: `server/src/modules/products/products.service.js`
- Modify: `server/src/modules/cart/cart.service.js`
- Modify: `server/src/modules/orders/orders.service.js`
- Modify: `server/src/modules/admin/admin.service.js`
- Test: `server/test/pricing.test.js`
- Modify: `server/test/products.test.js`
- Modify: `server/test/cart-orders.test.js`

**Interfaces:**
- `calculateVariantPrice(basePrice, discountPercent, legacyPriceDelta = null)` returns a non-negative number rounded to cents.
- `normalizeDiscountPercent(value)` accepts `0..100` and rejects invalid values with HTTP 400.

- [ ] **Step 1: Add failing unit tests** for `0%`, `10%`, `100%`, decimal percentages, rounding and legacy fallback.
- [ ] **Step 2: Run `node --test server/test/pricing.test.js`** and confirm the helper is missing.
- [ ] **Step 3: Implement the helper** with decimal-safe rounding and a temporary legacy fallback only for rows migrated from `price_delta`.
- [ ] **Step 4: Replace SQL expressions** `(p.base_price + pv.price_delta)` in catalog/cart/order reads with `discount_percent` calculation, or return the raw fields and calculate through the shared helper where SQL portability is needed.
- [ ] **Step 5: Rename API mappings** from `priceDelta` to `discountPercent`; accept legacy input only in internal migration tests, never from the new admin UI.
- [ ] **Step 6: Run product/cart/order tests** and commit `feat: calculate variant prices from discounts`.

### Task 3: Admin Variant Form and Product/RAG Price Context

**Files:**
- Modify: `client/src/pages/admin/AdminProductFormPage.jsx`
- Modify: `client/src/pages/ProductDetailPage.jsx`
- Modify: `server/src/modules/rag/ragIndex.service.js`
- Modify: `server/src/modules/rag/ragRetrieval.service.js`
- Modify: `client/test/admin-flow.test.jsx`
- Modify: `client/test/customer-flow.test.jsx`
- Modify: `server/test/rag.test.js`

**Interfaces:**
- Admin payload uses `discountPercent`.
- Product, cart and RAG responses expose `discountPercent`, `unitPrice`/`price` after discount, and never expose `priceDelta` to the UI.

- [ ] **Step 1: Update failing frontend tests** to locate `% giảm giá`, submit `discountPercent`, and assert the resulting displayed price.
- [ ] **Step 2: Run focused frontend tests** and confirm they fail against the current `priceDelta` form.
- [ ] **Step 3: Change the form labels, inputs and table headers** to `% giảm giá`, with `min=0`, `max=100`, `step=0.01`.
- [ ] **Step 4: Update product detail and RAG document generation** to use the shared backend price fields and show the original/discounted relationship without inventing prices.
- [ ] **Step 5: Run client and RAG tests** and commit `feat: expose variant discounts in product flows`.

### Task 4: VNPay Signing and Payment Service

**Files:**
- Create: `server/src/modules/payments/vnpay.service.js`
- Modify: `server/src/config/env.js`
- Modify: `server/.env.example` without real secrets
- Create: `server/test/vnpay.test.js`

**Interfaces:**
- `createPaymentUrl({ orderId, orderCode, amount, ipAddress })` returns a fully signed VNPay URL.
- `verifyPaymentParams(params)` returns `{ valid, responseCode, transactionNo, amount }` without mutating the database.
- `buildVnpayResponse(code, message)` returns the VNPay IPN JSON contract.

- [ ] **Step 1: Write failing tests** for sorted URL encoding, HMAC-SHA512 signature, amount conversion to minor units, valid callback, wrong signature and wrong amount.
- [ ] **Step 2: Run focused VNPay tests** and confirm the service is missing.
- [ ] **Step 3: Implement signing and verification** with Node `crypto` and `URLSearchParams`; exclude `vnp_SecureHash` and `vnp_SecureHashType` from the signed payload and encode values exactly once.
- [ ] **Step 4: Add environment parsing** for `VNPAY_HOST`, `VNPAY_TMN_CODE`, `VNPAY_SECURE_SECRET`, `VNPAY_RETURN_URL`, `VNPAY_IPN_URL`, `VNPAY_TEST_MODE` and `FRONTEND_URL`.
- [ ] **Step 5: Run focused tests** and commit `feat: add vnpay sandbox signing service`.

### Task 5: VNPay Order Creation and Callback Routes

**Files:**
- Create: `server/src/modules/payments/payments.routes.js`
- Modify: `server/src/modules/orders/orders.service.js`
- Modify: `server/src/modules/orders/orders.routes.js`
- Modify: `server/src/app.js`
- Modify: `server/test/cart-orders.test.js`
- Create: `server/test/payments.test.js`

**Interfaces:**
- `POST /api/orders` accepts `paymentMethod: 'cod' | 'vnpay'`.
- `GET /api/payments/vnpay/return` returns a frontend-safe payment result.
- `GET /api/payments/vnpay/ipn` returns VNPay response JSON and updates one order idempotently.

- [ ] **Step 1: Write failing API tests** for VNPay order creation, pending state, successful IPN, failed IPN, wrong signature, wrong amount and repeated IPN.
- [ ] **Step 2: Run focused payment tests** and confirm the new routes and payment method are absent.
- [ ] **Step 3: Refactor shared order creation** so COD and VNPay use the same locked cart snapshot, server-side discount price calculation, stock validation and order item snapshot.
- [ ] **Step 4: Implement VNPay order creation** to create one pending order, build the URL, and return `{ order, paymentUrl }` without clearing cart or decrementing stock twice.
- [ ] **Step 5: Implement IPN transaction handling** with `SELECT ... FOR UPDATE`, verify order code/amount/signature, mark paid or failed, and make retries idempotent.
- [ ] **Step 6: Implement return route** that verifies parameters and redirects to `FRONTEND_URL/payment-result` with a non-authoritative status token/result.
- [ ] **Step 7: Run all order/payment tests** and commit `feat: add vnpay order callbacks`.

### Task 6: Checkout and Order Status UI

**Files:**
- Modify: `client/src/pages/CheckoutPage.jsx`
- Create: `client/src/pages/PaymentResultPage.jsx`
- Modify: `client/src/pages/OrdersPage.jsx`
- Modify: `client/src/pages/OrderDetailPage.jsx`
- Modify: `client/src/App.jsx`
- Modify: `client/test/customer-flow.test.jsx`
- Modify: `client/src/styles.css`

**Interfaces:**
- Checkout sends `paymentMethod` and redirects only when the backend returns `paymentUrl`.
- Payment result page reads backend result and displays pending/success/failure clearly.

- [ ] **Step 1: Write failing UI tests** for COD selection, VNPay selection, payment URL redirect, disabled submit and payment result states.
- [ ] **Step 2: Run focused client tests** and confirm the current COD-only checkout fails these expectations.
- [ ] **Step 3: Add a payment method control** and update labels/summary dynamically for COD versus VNPay.
- [ ] **Step 4: Add the payment result route/page** and show `pending`, `paid`, `failed` without trusting an arbitrary query string as proof of payment.
- [ ] **Step 5: Update order pages** to show VNPay method and payment status labels.
- [ ] **Step 6: Run client tests and build** and commit `feat: add vnpay checkout flow`.

### Task 7: Documentation, Full Verification, and Delivery

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `server/.env.example` with placeholders only
- Test: all existing test files

- [ ] **Step 1: Document VNPay Sandbox setup**, including a public HTTPS IPN tunnel for local testing and the exact environment variable names.
- [ ] **Step 2: Add an end-to-end test checklist** covering discount pricing, COD, VNPay URL, successful IPN, failed IPN and repeated IPN.
- [ ] **Step 3: Run `npm test` and confirm the complete suite passes.**
- [ ] **Step 4: Run `npm run build` and `git diff --check`.**
- [ ] **Step 5: Review `git diff` for secrets and unrelated dirty files; do not stage `DEVELOPMENT_PROMPT.md`, existing user CSS changes, or real environment keys.**
- [ ] **Step 6: Commit `docs: document vnpay sandbox setup` and push the feature branch after verification.**
