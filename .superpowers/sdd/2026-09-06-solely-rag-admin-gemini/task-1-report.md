# Task 1 Report: RAG Schema and Seed Data

## Status

Implemented and committed Task 1 for the Solely RAG Admin Gemini plan.

## Scope Completed

- Added `CREATE EXTENSION IF NOT EXISTS vector;` to `shoe-store/database/schema.sql`.
- Added `rag_documents` with title, slug, document type, content, status, indexing timestamp, timestamps, and status/type check constraints.
- Added `rag_chunks` with source metadata, chunk index, title/content, JSON metadata, `embedding vector(768)`, embedding model, status, timestamps, and uniqueness on `(source_type, source_id, chunk_index)`.
- Added RAG chunk indexes:
  - `rag_chunks_source_idx`
  - `rag_chunks_status_idx`
  - `rag_chunks_embedding_idx` using `ivfflat` and `vector_cosine_ops`.
- Kept existing `ai_chat_messages` table in place.
- Seeded default active Vietnamese policy documents in `shoe-store/database/seed.sql`:
  - `Cách đặt hàng` / `cach-dat-hang`
  - `Thanh toán COD` / `thanh-toan-cod`
  - `Vận chuyển` / `van-chuyen`
  - `Đổi trả` / `doi-tra`
  - `Bảo hành` / `bao-hanh`
  - `Hướng dẫn chọn size` / `huong-dan-chon-size`
  - `Điều khoản mua hàng` / `dieu-khoan-mua-hang`
- Added the same RAG policy documents to `shoe-store/database/localize-vietnamese-products.sql` with `ON CONFLICT (slug) DO UPDATE` so local refreshes can update these rows.
- Updated `shoe-store/scripts/db-setup.js` to run:
  - `database/schema.sql`
  - `database/seed.sql`
  - `database/localize-vietnamese-products.sql`
- Added database-file tests for the RAG schema, seed policy documents, and setup sequence.
- Updated `shoe-store/CHANGELOG.md` in Vietnamese under `## Chưa phát hành`.

## TDD Evidence

1. Added failing tests to `shoe-store/server/test/database-files.test.js`.
2. Ran focused database-file test before implementation:

```bash
cd shoe-store/server
node --test --require ./test/setup.js test/database-files.test.js
```

Result: failed as expected with 5 passing and 3 failing tests. Failures covered missing pgvector/RAG schema, missing default RAG policy document seed content, and missing localization file in `db-setup.js`.

3. Implemented minimal schema, seed, localization, setup, and changelog changes.
4. Re-ran focused database-file test:

```bash
cd shoe-store/server
node --test --require ./test/setup.js test/database-files.test.js
```

Result: passed, 8/8 tests.

## Verification

Ran:

```bash
npm test --workspace server
```

Result: passed, 61/61 server tests.

Ran:

```bash
git diff --check
```

Result: passed with exit code 0 and no whitespace errors.

## Files Changed

- `shoe-store/database/schema.sql`
- `shoe-store/database/seed.sql`
- `shoe-store/database/localize-vietnamese-products.sql`
- `shoe-store/scripts/db-setup.js`
- `shoe-store/server/test/database-files.test.js`
- `shoe-store/CHANGELOG.md`
- `.superpowers/sdd/2026-09-06-solely-rag-admin-gemini/task-1-report.md`

## Files Intentionally Left Unstaged/Untouched

- `shoe-store/DEVELOPMENT_PROMPT.md`
- `shoe-store/client/src/styles.css`

These were dirty before Task 1 work and are unrelated to this task.

## Out of Scope

- No Gemini client/service implementation.
- No admin API implementation.
- No admin UI implementation.
- No changes to frontend secret handling.
- No removal of `ai_chat_messages`.

## Concerns

- `schema.sql` now requires the PostgreSQL `pgvector` extension to be installed in the target database environment before `db:setup` can succeed.
