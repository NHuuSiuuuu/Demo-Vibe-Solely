# Gemini Image Product Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép khách hàng chọn/chụp ảnh từ nút camera cạnh ô tìm kiếm và nhận các sản phẩm giày tương tự bằng Gemini Embedding 2 + PostgreSQL pgvector.

**Architecture:** Tách vector ảnh khỏi `rag_chunks` bằng bảng `product_image_embeddings`. Backend dùng `multer` memory storage để nhận ảnh query, Gemini backend client để tạo vector 768 chiều và một product image search service để truy vấn cosine similarity, gom nhiều ảnh về một sản phẩm rồi áp dụng bộ lọc catalog. Ảnh query không được lưu; ảnh catalog được index khi admin upload và có thể reindex từ `/admin/rag`.

**Tech Stack:** React 18, Vite, Node.js, Express, PostgreSQL, pgvector, Gemini API `gemini-embedding-2`, `multer`, Vitest, Node test runner, Supertest.

**Spec:** `shoe-store/docs/superpowers/specs/2026-09-07-product-image-search-gemini-design.md`

## Global Constraints

- Gemini API key chỉ nằm trong backend environment; không log base64, bytes ảnh, stack trace hoặc key.
- Ảnh query chỉ xử lý trong memory, không lưu database hoặc Cloudinary.
- Chỉ nhận JPEG/PNG, giới hạn request ảnh 8 MB.
- Vector ảnh dùng `vector(768)` và model mặc định `gemini-embedding-2`.
- Không trộn retrieval ảnh vào `rag_chunks` hoặc thay đổi chatbot RAG text.
- Lỗi index Gemini không được làm fail thao tác lưu sản phẩm; phải đánh dấu lỗi để retry.
- Giữ nguyên các thay đổi VNPay và các file dirty có trước khi bắt đầu plan này.
- Mọi thay đổi code/database/config/tài liệu phải cập nhật `shoe-store/CHANGELOG.md` bằng tiếng Việt.
- Không commit API key thật.

## File Map

### Backend/database

- Create `shoe-store/database/migrations/20260907-product-image-search.sql`: migration cộng dồn tạo bảng và index image embedding.
- Modify `shoe-store/database/schema.sql`: bootstrap/drop/index bảng image embedding cho database mới.
- Modify `shoe-store/scripts/db-migrate.js`: chạy migration image search sau các migration catalog hiện có.
- Modify `shoe-store/server/package.json` and lockfile: thêm `multer` để parse multipart memory-only.
- Modify `shoe-store/server/src/modules/rag/gemini.client.js`: thêm `embedImage({ data, mimeType })` và cấu hình model/dimension.
- Create `shoe-store/server/src/modules/imageSearch/imageSearch.service.js`: validation, indexing, similarity search và mapping product cards.
- Modify `shoe-store/server/src/modules/products/products.routes.js`: endpoint public image search và middleware multipart.
- Modify `shoe-store/server/src/modules/admin/admin.routes.js`: endpoint overview/reindex image embedding cho admin.
- Modify `shoe-store/server/src/modules/admin/admin.service.js`: trigger best-effort image indexing sau product/image mutation và giữ catalog save độc lập.
- Modify `shoe-store/server/src/modules/rag/rag.routes.js`: bổ sung số liệu image embedding vào overview/reindex route hiện có hoặc route con cùng quyền admin.
- Create or modify focused backend tests under `shoe-store/server/test/`: migration, image client, image search route/service, admin reindex and product-save failure isolation.

### Frontend

- Modify `shoe-store/client/src/api/client.js`: hỗ trợ request `FormData` mà không ép `Content-Type: application/json`.
- Modify `shoe-store/client/src/pages/ProductListPage.jsx`: camera button, hidden file input, preview, image-search loading/error/empty state, reset và filter preservation.
- Modify `shoe-store/client/src/pages/admin/AdminRagPage.jsx`: image embedding counts/model/status/reindex controls.
- Modify `shoe-store/client/src/styles.css`: chỉ thêm style cho camera control, preview và trạng thái image search theo convention hiện tại.
- Modify `shoe-store/client/test/customer-flow.test.jsx` or create focused image-search test: camera input and result/error/reset behavior.
- Modify `shoe-store/client/test/admin-flow.test.jsx`: admin image index status and reindex interaction.

### Documentation

- Modify `shoe-store/server/.env.example`: document `GEMINI_IMAGE_EMBEDDING_MODEL`, `GEMINI_EMBEDDING_DIMENSION` and upload limit if configurable.
- Modify `shoe-store/README.md`: setup pgvector, image indexing, camera/file search and live verification caveat.
- Modify `shoe-store/CHANGELOG.md`: Vietnamese unreleased entry.

### Task 1: Add the image embedding database contract

**Files:**
- Create: `shoe-store/database/migrations/20260907-product-image-search.sql`
- Modify: `shoe-store/database/schema.sql`
- Modify: `shoe-store/scripts/db-migrate.js`
- Test: `shoe-store/server/test/image-search-schema.test.js`

**Interfaces:**
- Produces table `product_image_embeddings` with `product_id`, `product_image_id`, `embedding vector(768)`, `embedding_model`, `status`, `error_message`, timestamps.
- Produces unique key `(product_image_id, embedding_model)` and cosine index on `embedding`.
- Produces migration ordering compatible with existing product catalog migration.

- [ ] **Step 1: Write failing schema tests**

Assert that `schema.sql` contains the drop/create table, FK cascade, `vector(768)`, status check, unique constraint and vector index. Assert that `db-migrate.js` includes `20260907-product-image-search.sql` after the existing migrations.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `cd shoe-store/server && npm test -- --test-name-pattern="image embedding schema"`

Expected: FAIL because the new table and migration entry do not exist yet.

- [ ] **Step 3: Implement the schema and migration**

Add the table after `product_images` is available, add `DROP TABLE IF EXISTS product_image_embeddings` before `product_images` in bootstrap, add product/image/status indexes, and append the migration file to the migration runner. Use `IF NOT EXISTS` and `ON_ERROR_STOP=1` so the migration is safe to rerun and failures are visible.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `cd shoe-store/server && npm test -- --test-name-pattern="image embedding schema"`

Expected: PASS. If a live PostgreSQL instance with pgvector is available, run `cd shoe-store && npm run db:migrate` and verify the command exits zero; otherwise record the missing pgvector limitation without weakening the schema test.

- [ ] **Step 5: Commit the database contract**

```bash
git add shoe-store/database/schema.sql shoe-store/database/migrations/20260907-product-image-search.sql shoe-store/scripts/db-migrate.js shoe-store/server/test/image-search-schema.test.js
git commit -m "feat: add product image embedding schema"
```

### Task 2: Add Gemini image embedding support

**Files:**
- Modify: `shoe-store/server/src/modules/rag/gemini.client.js`
- Modify: `shoe-store/server/.env.example`
- Test: `shoe-store/server/test/gemini-image-embedding.test.js`

**Interfaces:**
- `embedImage({ data: Buffer, mimeType: string }): Promise<number[]>` returns a finite vector with configured dimension.
- `getImageEmbeddingConfig(): { model: string, dimension: number }` exposes non-secret configuration for admin status only.
- Existing `embedText()` behavior and model remain unchanged for RAG text.

- [ ] **Step 1: Write failing client tests**

Mock `global.fetch` and assert `embedImage()` posts inline base64 data to `models/gemini-embedding-2:embedContent`, sends the image MIME type, returns the `values` array, rejects unsupported MIME types, rejects a missing API key and rejects a response whose vector dimension is not 768. Assert that the request body and thrown errors never contain the API key in returned messages.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `cd shoe-store/server && npm test -- --test-name-pattern="Gemini image embedding"`

Expected: FAIL because `embedImage()` and image configuration do not exist.

- [ ] **Step 3: Implement the minimal client extension**

Keep the existing fetch style and backend-only API key. Add `GEMINI_IMAGE_EMBEDDING_MODEL` defaulting to `gemini-embedding-2`, `GEMINI_EMBEDDING_DIMENSION` defaulting to `768`, MIME validation for `image/jpeg` and `image/png`, base64 conversion only inside the request body, HTTP/error parsing without secrets, and response dimension validation.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `cd shoe-store/server && npm test -- --test-name-pattern="Gemini image embedding"`

Expected: PASS with mocked Gemini responses. Do not call the real API in unit tests.

- [ ] **Step 5: Commit the Gemini client**

```bash
git add shoe-store/server/src/modules/rag/gemini.client.js shoe-store/server/.env.example shoe-store/server/test/gemini-image-embedding.test.js
git commit -m "feat: support Gemini image embeddings"
```

### Task 3: Build image indexing and similarity search services

**Files:**
- Create: `shoe-store/server/src/modules/imageSearch/imageSearch.service.js`
- Test: `shoe-store/server/test/image-search.service.test.js`

**Interfaces:**
- `validateImageInput(file): { data: Buffer, mimeType: string }` throws `HttpError(400, ...)` for missing/unsupported/oversized files.
- `indexProductImage({ productId, productImageId, imageUrl }): Promise<{ status: 'active' | 'error', ... }>` fetches catalog image bytes, calls `embedImage`, upserts by image/model and records error status without throwing for provider failures.
- `reindexProductImages(productId): Promise<{ indexed: number, failed: number }>` indexes all current product images.
- `reindexAllProductImages(): Promise<{ indexed: number, failed: number }>` indexes all active product images.
- `searchProductsByImage({ data, mimeType, filters, limit }): Promise<{ products: object[], threshold: number }>` embeds the query and returns unique active product cards ordered by best cosine score.
- `getImageEmbeddingOverview(): Promise<object>` returns counts, model, dimension and last indexed timestamp without exposing secrets.

- [ ] **Step 1: Write failing service tests**

Mock the database and `gemini.client` and cover: valid JPEG/PNG, missing file, unsupported MIME, >8 MB; idempotent upsert; provider failure creates `error` status; multiple images for one product collapse to the highest score; hidden products and vectors below threshold are excluded; filters are parameterized; overview returns counts and config only.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `cd shoe-store/server && npm test -- --test-name-pattern="image search service"`

Expected: FAIL because the service module and database queries do not exist.

- [ ] **Step 3: Implement validation and catalog indexing**

Use an 8 MB limit, accept only JPEG/PNG, fetch Cloudinary image bytes server-side for catalog indexing, call `embedImage`, and use `INSERT ... ON CONFLICT (product_image_id, embedding_model) DO UPDATE`. On provider/download failure, upsert `status = 'error'` and a safe short error message; do not store image bytes.

- [ ] **Step 4: Implement similarity retrieval**

Use a parameterized CTE that ranks image rows by `1 - (embedding <=> $query::vector)`, filters active products/images/embeddings, applies the existing brand/gender/size/color/price constraints, groups by `product_id`, keeps the maximum score, joins the same product-card fields as `listProducts`, and applies `LIMIT 12`. Use a threshold of `0.35` and return an empty result when no row reaches it.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `cd shoe-store/server && npm test -- --test-name-pattern="image search service"`

Expected: PASS, including SQL parameterization assertions and failure isolation.

- [ ] **Step 6: Commit the service boundary**

```bash
git add shoe-store/server/src/modules/imageSearch/imageSearch.service.js shoe-store/server/test/image-search.service.test.js
git commit -m "feat: index and retrieve product images"
```

### Task 4: Expose public image search and admin reindex APIs

**Files:**
- Modify: `shoe-store/server/package.json` and lockfile
- Modify: `shoe-store/server/src/modules/products/products.routes.js`
- Modify: `shoe-store/server/src/modules/admin/admin.routes.js`
- Modify: `shoe-store/server/src/modules/admin/admin.service.js`
- Modify: `shoe-store/server/src/modules/rag/rag.routes.js`
- Test: `shoe-store/server/test/image-search.routes.test.js`
- Test: `shoe-store/server/test/admin.test.js`

**Interfaces:**
- Public `POST /api/products/search-by-image` accepts multipart field `image` and optional catalog filters.
- Admin `GET /api/admin/rag/image-overview` returns image counts/model/dimension.
- Admin `POST /api/admin/rag/images/reindex` reindexes all images.
- Admin `POST /api/admin/rag/products/:id/image-reindex` reindexes one product’s images.
- Admin product image creation triggers best-effort `indexProductImage` after the catalog row is saved.

- [ ] **Step 1: Add multipart dependency and write failing route tests**

Add `multer` with memory storage and `limits.fileSize = 8 * 1024 * 1024`. Test public success, missing file (400), unsupported MIME (400), service/provider error (503 or stable 500 JSON), unauthenticated admin endpoint (401), customer admin endpoint (403), admin overview/reindex success, and product save success when image indexing fails.

- [ ] **Step 2: Run the focused route tests and verify they fail**

Run: `cd shoe-store/server && npm test -- --test-name-pattern="image search route|image reindex"`

Expected: FAIL because routes, middleware and dependency are not present.

- [ ] **Step 3: Implement public route**

Register `/search-by-image` before `/:slug` so it is not treated as a slug. Use `upload.single('image')`, pass `req.file.buffer` and `req.file.mimetype` to the service, pass only allowlisted filter fields, and return `{ products, query: { type: 'image' }, threshold }`.

- [ ] **Step 4: Implement admin routes and product upload hook**

Protect admin endpoints with existing auth/admin middleware. Reuse the existing RAG admin route style. After `createProductImage()` commits the product image row, call image indexing in a detached best-effort block; retain the existing catalog response even when Gemini is unavailable. Add explicit admin reindex handlers with counts and safe errors.

- [ ] **Step 5: Run the focused route tests and verify they pass**

Run: `cd shoe-store/server && npm test -- --test-name-pattern="image search route|image reindex"`

Expected: PASS. Then run `cd shoe-store/server && npm test` and confirm the existing suite remains green.

- [ ] **Step 6: Commit the API layer**

```bash
git add shoe-store/server/package.json shoe-store/server/package-lock.json shoe-store/server/src/modules/products/products.routes.js shoe-store/server/src/modules/admin/admin.routes.js shoe-store/server/src/modules/admin/admin.service.js shoe-store/server/src/modules/rag/rag.routes.js shoe-store/server/test/image-search.routes.test.js shoe-store/server/test/admin.test.js
git commit -m "feat: expose image search and reindex APIs"
```

### Task 5: Add the customer camera search interaction

**Files:**
- Modify: `shoe-store/client/src/api/client.js`
- Modify: `shoe-store/client/src/pages/ProductListPage.jsx`
- Modify: `shoe-store/client/src/styles.css`
- Test: `shoe-store/client/test/image-search.test.jsx`

**Interfaces:**
- `apiClient.postForm(path, formData, options)` sends `FormData` without setting JSON `Content-Type` and returns the existing JSON/error shape.
- `ProductListPage` keeps text/filter state, adds image-search state `{ file, previewUrl, status, error }`, and renders returned product cards.

- [ ] **Step 1: Write failing frontend tests**

Mock `fetch` and assert the camera button has a Vietnamese accessible label, the hidden input has `accept="image/jpeg,image/png"` and `capture="environment"`, selecting an image sends `FormData` to `/api/products/search-by-image`, loading and results render, errors render, and clearing the image restores the normal text catalog request.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `cd shoe-store/client && npm test -- --run image-search.test.jsx`

Expected: FAIL because `postForm`, camera control and image state do not exist.

- [ ] **Step 3: Implement FormData API support**

Add a separate `postForm` method. Do not set `Content-Type`; let the browser add the multipart boundary. Preserve auth header support and the current JSON error parsing.

- [ ] **Step 4: Implement the camera control and state transitions**

Add a hidden file input referenced by a camera icon button, validate client-side type/size before request, create/revoke the preview object URL, call `postForm`, preserve active filter values as optional fields, replace results on success, and provide retry/clear controls. Do not modify the existing text search request contract.

- [ ] **Step 5: Add focused styles and accessibility**

Place the icon button in the existing search control without hiding the label, add visible focus state, preview sizing, loading state and mobile layout. Keep the existing styles and unrelated dirty stylesheet changes intact.

- [ ] **Step 6: Run focused and existing client tests**

Run: `cd shoe-store/client && npm test -- --run image-search.test.jsx`

Expected: PASS.

Then run: `cd shoe-store/client && npm test`

Expected: all existing client tests plus image-search tests pass.

- [ ] **Step 7: Commit the customer UI**

```bash
git add shoe-store/client/src/api/client.js shoe-store/client/src/pages/ProductListPage.jsx shoe-store/client/src/styles.css shoe-store/client/test/image-search.test.jsx
git commit -m "feat: add camera product search"
```

### Task 6: Add admin image embedding visibility and controls

**Files:**
- Modify: `shoe-store/client/src/pages/admin/AdminRagPage.jsx`
- Modify: `shoe-store/client/src/styles.css`
- Modify: `shoe-store/client/test/admin-flow.test.jsx`

**Interfaces:**
- Consumes `GET /api/admin/rag/image-overview`, `POST /api/admin/rag/images/reindex`, and `POST /api/admin/rag/products/:id/image-reindex`.
- Produces visible image index count, failed/stale count, model/dimension, last indexed timestamp and admin retry actions.

- [ ] **Step 1: Write failing admin UI tests**

Mock overview and reindex requests; assert the page renders image index status, disables reindex while running, shows returned counts, surfaces errors, and sends the selected product ID for per-product reindex.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `cd shoe-store/client && npm test -- --run admin-flow.test.jsx`

Expected: FAIL because image overview controls are absent.

- [ ] **Step 3: Implement the admin panel**

Load image overview alongside existing RAG overview/documents, add a compact image indexing section, wire global/product reindex buttons, and distinguish “chưa index”, “đã index”, “cần reindex” and “lỗi”. Do not expose API key or raw provider errors.

- [ ] **Step 4: Run focused admin tests**

Run: `cd shoe-store/client && npm test -- --run admin-flow.test.jsx`

Expected: PASS without regressing existing RAG admin tests.

- [ ] **Step 5: Commit the admin controls**

```bash
git add shoe-store/client/src/pages/admin/AdminRagPage.jsx shoe-store/client/src/styles.css shoe-store/client/test/admin-flow.test.jsx
git commit -m "feat: manage product image embeddings in admin"
```

### Task 7: Document configuration and perform full verification

**Files:**
- Modify: `shoe-store/README.md`
- Modify: `shoe-store/server/.env.example`
- Modify: `shoe-store/CHANGELOG.md`
- Test: existing server/client test suites and build commands

- [ ] **Step 1: Update configuration and README**

Document the two Gemini model settings, 768 dimension, pgvector prerequisite, image MIME/size limits, camera behavior on mobile, admin reindex flow, no-storage privacy behavior and a live test sequence. State explicitly that a local environment without pgvector or a valid Gemini key cannot claim end-to-end success.

- [ ] **Step 2: Add the Vietnamese changelog entry**

Under `## Chưa phát hành`, record the image embedding table/API/customer camera/admin reindex changes and the verification limitations, without including any secret.

- [ ] **Step 3: Run backend verification**

Run: `cd shoe-store/server && npm test`

Expected: all backend tests pass, including image schema/client/service/routes and existing RAG/payment tests.

- [ ] **Step 4: Run frontend verification**

Run: `cd shoe-store/client && npm test && npm run build`

Expected: all frontend tests pass and Vite build exits zero.

- [ ] **Step 5: Run repository checks**

Run: `git diff --check`

Expected: no whitespace errors. Review `git status --short` and confirm only intended image-search commits plus pre-existing VNPay dirty files remain.

- [ ] **Step 6: Run live smoke test when dependencies exist**

With pgvector installed and a rotated `GEMINI_API_KEY` configured only in `server/.env`: run the migration, start server/client, admin reindex one product image, use desktop file picker, use mobile camera mode if available, confirm result ordering and filters, then test Gemini/pgvector failure messaging. If dependencies are missing, report the exact blocked command and do not call the feature production-ready.

- [ ] **Step 7: Commit documentation and verification evidence**

```bash
git add shoe-store/README.md shoe-store/server/.env.example shoe-store/CHANGELOG.md
git commit -m "docs: document Gemini image search"
```

## Plan Self-Review

- Spec coverage: database contract is Task 1; Gemini image embedding is Task 2; indexing/retrieval/privacy is Task 3; public/admin APIs and failure isolation are Task 4; customer camera/file UX is Task 5; admin visibility is Task 6; configuration and verification are Task 7.
- Placeholder scan: no unresolved placeholder or unspecified implementation step is required; every task names files, interfaces, tests, commands and expected outcomes.
- Type consistency: `embedImage` returns `number[]`; image service consumes it and writes `vector(768)`; routes consume image service results; frontend consumes `{ products, query, threshold }` and uses existing product card shape.
- Scope check: no camera streaming subsystem, text RAG replacement, user image history, video/PDF support or unrelated payment changes are included.
