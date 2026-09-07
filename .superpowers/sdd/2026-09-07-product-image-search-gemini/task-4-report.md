# Task 4 Report

Status: DONE_WITH_CONCERNS

Commit: `ed4f0e2 feat: expose image search and reindex APIs`

## Implemented

- Added the public multipart `POST /api/products/search-by-image` route with multer memory storage, an 8 MB limit, JPEG/PNG validation, allowlisted catalog filters, and a stable 503 provider-error response.
- Added authenticated admin image overview, global reindex, and per-product reindex endpoints under `/api/admin/rag`.
- Added detached best-effort `indexProductImage` execution after the product image row is saved; catalog image creation remains successful when indexing fails.
- Preserved existing VNPay changes in admin files and staged only image-search hunks from those files.

## Verification

- `node --test --require ./test/setup.js test/image-search.routes.test.js` — 6/6 passed.
- `node --test --require ./test/setup.js test/admin.test.js test/products.test.js` — 44/44 passed.
- `npm test -- --test-name-pattern="image search route|image reindex"` — image route cases passed, but the package script loaded the full test glob and 21 unrelated PGlite-backed tests failed because the local test database lacks the `vector` type.

## Concerns

- Full server-suite verification remains environment-limited by the existing local PGlite/pgvector incompatibility; no image-search route test failed.

## Fix Round 1

Commit: `f01d969 fix: harden image search route errors`

- All Multer input errors now return stable JSON `400`; `LIMIT_FILE_SIZE` retains `Image must not exceed 8 MB`, while unexpected fields and duplicate `image` files return `Invalid image upload`.
- Added exact 8 MB acceptance, 8 MB + 1 byte rejection with no service call, all-endpoint 401/403 coverage, all-endpoint stable 503 coverage, product-id forwarding, and sanitized detached-index warning coverage.
- Detached indexing still cannot change the successful catalog-image response; the warning includes only a generic message and numeric IDs.

### Exact verification

- RED: `node --test --require ./test/setup.js test/image-search.routes.test.js test/admin.test.js` — 43 passed, 2 failed at the intended gaps (unexpected/duplicate Multer input returned 500; detached warning was absent).
- GREEN: `node --test --require ./test/setup.js test/image-search.routes.test.js test/admin.test.js test/products.test.js` — 54 passed, 0 failed.
- `git diff --check` — passed.

The full server suite was not rerun in this fix round to avoid the previously documented unrelated local PGlite `vector`-type failures.
