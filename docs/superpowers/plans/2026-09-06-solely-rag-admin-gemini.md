# Solely RAG Admin Gemini Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Gemini-powered RAG knowledge system for Solely so customers can ask about products, ordering, COD payment, shipping, returns, warranty, terms, and size guidance while admins manage and test the knowledge base.

**Architecture:** Add PostgreSQL RAG tables for admin documents and vector chunks, then build focused Express services for Gemini, indexing, retrieval, and admin management. The existing floating AI assistant will call the RAG-backed `/api/ai/chat`; the admin dashboard gets `/admin/rag` for status, policy document CRUD, reindexing, and test queries.

**Tech Stack:** React, Vite, React Router, Node.js, Express, PostgreSQL, pgvector, Gemini API via backend `fetch`, `pg`, `bcryptjs`, `jsonwebtoken`, Vitest, Supertest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-06-solely-rag-admin-gemini-design.md`

## Global Constraints

- Keep the existing stack: React, Vite, Node.js, Express, PostgreSQL, JWT auth, and admin/customer roles.
- Gemini API calls happen only in the Express backend.
- Frontend never receives or stores `GEMINI_API_KEY`.
- The RAG assistant should stop writing to `ai_chat_messages`, but physical table removal is a later cleanup task.
- Customer chat endpoint remains authenticated with JWT.
- Admin RAG endpoints require JWT and role `admin`.
- `GEMINI_EMBEDDING_DIMENSIONS=768` is the default vector dimension.
- Missing `GEMINI_API_KEY` must produce clear admin status and graceful customer fallback.
- Update `shoe-store/CHANGELOG.md` in Vietnamese for every meaningful code, database, UI, config, or documentation change.
- Do not stage or revert unrelated dirty files such as `shoe-store/DEVELOPMENT_PROMPT.md` or unrelated `shoe-store/client/src/styles.css` hunks.

---

## File Structure

Create:

```text
shoe-store/server/src/modules/rag/
  gemini.client.js
  rag.service.js
  rag.routes.js
  ragIndex.service.js
  ragRetrieval.service.js
  ragText.service.js
shoe-store/server/test/rag.test.js
shoe-store/client/src/pages/admin/AdminRagPage.jsx
```

Modify:

```text
shoe-store/database/schema.sql
shoe-store/database/seed.sql
shoe-store/database/localize-vietnamese-products.sql
shoe-store/scripts/db-setup.js
shoe-store/server/.env.example
shoe-store/server/src/app.js
shoe-store/server/src/config/env.js
shoe-store/server/src/modules/admin/admin.routes.js
shoe-store/server/src/modules/admin/admin.service.js
shoe-store/server/src/modules/ai/ai.service.js
shoe-store/server/test/ai.test.js
shoe-store/server/test/admin.test.js
shoe-store/server/test/database-files.test.js
shoe-store/client/src/App.jsx
shoe-store/client/src/pages/admin/AdminLayout.jsx
shoe-store/client/src/components/AiAssistant.jsx
shoe-store/client/test/admin-flow.test.jsx
shoe-store/client/test/customer-flow.test.jsx
shoe-store/client/src/styles.css
shoe-store/README.md
shoe-store/CHANGELOG.md
```

---

### Task 1: RAG Schema and Seed Data

**Files:**
- Modify: `shoe-store/database/schema.sql`
- Modify: `shoe-store/database/seed.sql`
- Modify: `shoe-store/database/localize-vietnamese-products.sql`
- Modify: `shoe-store/scripts/db-setup.js`
- Modify: `shoe-store/server/test/database-files.test.js`
- Modify: `shoe-store/CHANGELOG.md`

**Interfaces:**
- Produces table `rag_documents`.
- Produces table `rag_chunks`.
- Produces seed rows for default active policy documents.
- Produces DB setup that applies schema, seed, and localization/upsert data in a repeatable local setup.

- [ ] **Step 1: Write failing database-file tests**

Add tests to `server/test/database-files.test.js`:

```js
test('schema defines RAG documents, chunks, pgvector extension, and vector indexes', () => {
  const schema = readDatabaseFile('schema.sql');

  assert.match(schema, /CREATE EXTENSION IF NOT EXISTS vector/i);
  assert.match(schema, /CREATE TABLE rag_documents/i);
  assert.match(schema, /CREATE TABLE rag_chunks/i);
  assert.match(schema, /embedding vector\(768\)/i);
  assert.match(schema, /rag_chunks_source_idx/i);
  assert.match(schema, /rag_chunks_embedding_idx/i);
});

test('seed data includes default RAG policy documents', () => {
  const seed = readDatabaseFile('seed.sql');

  ['Cách đặt hàng', 'Thanh toán COD', 'Vận chuyển', 'Đổi trả', 'Bảo hành', 'Hướng dẫn chọn size', 'Điều khoản mua hàng'].forEach((title) => {
    assert.match(seed, new RegExp(title));
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
cd shoe-store/server
node --test --require ./test/setup.js test/database-files.test.js
```

Expected: FAIL because RAG schema and seed documents do not exist yet.

- [ ] **Step 3: Add RAG schema**

Add to `database/schema.sql` before `ai_chat_messages` or after product/order tables:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE rag_documents (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  document_type TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rag_documents_type_check CHECK (document_type IN ('ordering', 'payment', 'shipping', 'returns', 'warranty', 'terms', 'size_guide', 'general')),
  CONSTRAINT rag_documents_status_check CHECK (status IN ('active', 'hidden', 'needs_reindex'))
);

CREATE TABLE rag_chunks (
  id BIGSERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id BIGINT NOT NULL,
  chunk_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(768),
  embedding_model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rag_chunks_source_type_check CHECK (source_type IN ('product', 'document')),
  CONSTRAINT rag_chunks_status_check CHECK (status IN ('active', 'hidden', 'needs_reindex')),
  UNIQUE (source_type, source_id, chunk_index)
);

CREATE INDEX rag_chunks_source_idx ON rag_chunks(source_type, source_id);
CREATE INDEX rag_chunks_status_idx ON rag_chunks(status);
CREATE INDEX rag_chunks_embedding_idx ON rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

If PGlite tests cannot execute pgvector SQL, update test setup to validate the SQL file text and keep runtime smoke tests focused on non-vector SQL. Do not remove the schema text assertions.

- [ ] **Step 4: Seed default policy documents**

Add `INSERT INTO rag_documents (...) VALUES ...` in `database/seed.sql` with Vietnamese content for:

```text
Cách đặt hàng
Thanh toán COD
Vận chuyển
Đổi trả
Bảo hành
Hướng dẫn chọn size
Điều khoản mua hàng
```

Use slugs:

```text
cach-dat-hang
thanh-toan-cod
van-chuyen
doi-tra
bao-hanh
huong-dan-chon-size
dieu-khoan-mua-hang
```

- [ ] **Step 5: Update localization/upsert script**

In `database/localize-vietnamese-products.sql`, add upsert for the same `rag_documents` rows:

```sql
INSERT INTO rag_documents (title, slug, document_type, content, status)
VALUES (...)
ON CONFLICT (slug) DO UPDATE
SET title = EXCLUDED.title,
    document_type = EXCLUDED.document_type,
    content = EXCLUDED.content,
    status = EXCLUDED.status,
    updated_at = NOW();
```

- [ ] **Step 6: Update db setup script**

Modify `scripts/db-setup.js` so setup still runs schema and seed. Do not hardcode secrets. If `localize-vietnamese-products.sql` is included, run it after seed:

```js
for (const file of ['database/schema.sql', 'database/seed.sql', 'database/localize-vietnamese-products.sql']) {
  // existing spawnSync psql logic
}
```

- [ ] **Step 7: Verify and commit**

Run:

```bash
npm test --workspace server
git diff --check
```

Commit:

```bash
git add shoe-store/database/schema.sql shoe-store/database/seed.sql shoe-store/database/localize-vietnamese-products.sql shoe-store/scripts/db-setup.js shoe-store/server/test/database-files.test.js shoe-store/CHANGELOG.md
git commit -m "feat: add RAG database schema"
```

---

### Task 2: Gemini Client and RAG Text Helpers

**Files:**
- Create: `shoe-store/server/src/modules/rag/gemini.client.js`
- Create: `shoe-store/server/src/modules/rag/ragText.service.js`
- Create: `shoe-store/server/test/rag.test.js`
- Modify: `shoe-store/server/src/config/env.js`
- Modify: `shoe-store/server/.env.example`
- Modify: `shoe-store/README.md`
- Modify: `shoe-store/CHANGELOG.md`

**Interfaces:**
- Produces `isGeminiConfigured(): boolean`.
- Produces `embedText(text: string): Promise<number[]>`.
- Produces `generateGroundedAnswer({ message, context, products }): Promise<string | null>`.
- Produces `buildProductKnowledgeText(product): string`.
- Produces `chunkText({ title, content, maxLength }): Array<{ chunkIndex, title, content }>` .

- [ ] **Step 1: Write failing tests**

Create `server/test/rag.test.js` and mock `global.fetch`:

```js
test('Gemini client reports missing key without calling fetch', async () => {
  delete process.env.GEMINI_API_KEY;
  const { isGeminiConfigured, embedText } = require('../src/modules/rag/gemini.client');

  assert.equal(isGeminiConfigured(), false);
  await assert.rejects(() => embedText('hello'), /GEMINI_API_KEY/);
});

test('RAG text helper chunks long Vietnamese policy text', () => {
  const { chunkText } = require('../src/modules/rag/ragText.service');
  const chunks = chunkText({ title: 'Đổi trả', content: 'Nội dung '.repeat(260), maxLength: 500 });

  assert.equal(chunks.length > 1, true);
  assert.equal(chunks[0].chunkIndex, 0);
  assert.match(chunks[0].title, /Đổi trả/);
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
cd shoe-store/server
node --test --require ./test/setup.js test/rag.test.js
```

Expected: FAIL because the RAG module does not exist.

- [ ] **Step 3: Implement Gemini client**

Create `gemini.client.js` with server-side fetch calls:

```js
const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';
const DEFAULT_CHAT_MODEL = 'gemini-2.5-flash';
const DEFAULT_DIMENSIONS = 768;

function getApiKey() {
  return process.env.GEMINI_API_KEY || '';
}

function isGeminiConfigured() {
  return Boolean(getApiKey());
}

async function embedText(text) {
  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_API_KEY is required for RAG embeddings');
  }
  const model = process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const outputDimensionality = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS || DEFAULT_DIMENSIONS);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${getApiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text }] },
      outputDimensionality
    })
  });
  if (!response.ok) {
    throw new Error(`Gemini embedding failed with ${response.status}`);
  }
  const payload = await response.json();
  return payload.embedding?.values || [];
}

module.exports = { isGeminiConfigured, embedText };
```

Also implement `generateGroundedAnswer` in the same file or a small companion export, using `generateContent` and prompt rules from the spec.

- [ ] **Step 4: Implement text helpers**

Create `ragText.service.js`:

```js
function chunkText({ title, content, maxLength = 1200 }) {
  const clean = String(content || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const chunks = [];
  for (let offset = 0; offset < clean.length; offset += maxLength) {
    chunks.push({
      chunkIndex: chunks.length,
      title,
      content: clean.slice(offset, offset + maxLength).trim()
    });
  }
  return chunks;
}

function buildProductKnowledgeText(product) {
  const sizes = product.availableSizes?.join(', ') || 'Chưa có size còn hàng';
  const colors = product.availableColors?.join(', ') || 'Chưa có màu còn hàng';
  return [
    `Sản phẩm: ${product.name}`,
    `Slug: ${product.slug}`,
    `Thương hiệu: ${product.brand}`,
    `Danh mục: ${product.category}`,
    `Giới tính: ${product.gender}`,
    `Giá: ${Number(product.price).toLocaleString('vi-VN')} ₫`,
    `Mô tả: ${product.description}`,
    `Size còn hàng: ${sizes}`,
    `Màu còn hàng: ${colors}`,
    `Tồn kho: ${Number(product.totalStock || 0)}`
  ].join('\n');
}

module.exports = { chunkText, buildProductKnowledgeText };
```

- [ ] **Step 5: Update env/docs**

Add to `server/.env.example`:

```env
GEMINI_API_KEY=
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS=768
GEMINI_CHAT_MODEL=gemini-2.5-flash
RAG_TOP_K=6
```

Update `README.md` with: do not commit keys; set Gemini key in `server/.env` or deployment environment.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test --workspace server
git diff --check
```

Commit:

```bash
git add shoe-store/server/src/modules/rag/gemini.client.js shoe-store/server/src/modules/rag/ragText.service.js shoe-store/server/test/rag.test.js shoe-store/server/src/config/env.js shoe-store/server/.env.example shoe-store/README.md shoe-store/CHANGELOG.md
git commit -m "feat: add Gemini RAG helpers"
```

---

### Task 3: RAG Indexing and Retrieval Services

**Files:**
- Create: `shoe-store/server/src/modules/rag/ragIndex.service.js`
- Create: `shoe-store/server/src/modules/rag/ragRetrieval.service.js`
- Create: `shoe-store/server/src/modules/rag/rag.service.js`
- Modify: `shoe-store/server/test/rag.test.js`
- Modify: `shoe-store/CHANGELOG.md`

**Interfaces:**
- Produces `reindexProduct(productId): Promise<{ status, chunksIndexed }>` .
- Produces `reindexDocument(documentId): Promise<{ status, chunksIndexed }>` .
- Produces `reindexAll(): Promise<{ productsIndexed, documentsIndexed, failed }>` .
- Produces `retrieveContext({ message, filters, limit }): Promise<{ chunks, sources, products }>` .
- Produces `answerWithRag({ user, message }): Promise<{ answer, products, sources }>` .

- [ ] **Step 1: Write failing service tests**

In `server/test/rag.test.js`, mock `../../db/pool` like existing AI tests and assert:

```js
test('reindexProduct stores product chunks with embeddings', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: true,
    async json() {
      return { embedding: { values: Array.from({ length: 768 }, () => 0.1) } };
    }
  });

  const { reindexProduct } = require('../src/modules/rag/ragIndex.service');
  const result = await reindexProduct(12);

  assert.equal(result.status, 'indexed');
  assert.equal(result.chunksIndexed >= 1, true);
});
```

Add a retrieval test:

```js
test('retrieveContext returns policy chunks without product cards for returns question', async () => {
  const { retrieveContext } = require('../src/modules/rag/ragRetrieval.service');
  const result = await retrieveContext({ message: 'Shop đổi trả như thế nào?', filters: {}, limit: 6 });

  assert.equal(result.products.length, 0);
  assert.equal(result.sources.some((source) => source.type === 'document'), true);
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd shoe-store/server
node --test --require ./test/setup.js test/rag.test.js
```

Expected: FAIL because indexing/retrieval services do not exist.

- [ ] **Step 3: Implement product/document indexing**

`ragIndex.service.js` responsibilities:

- load product with variants and active image
- build product text with `buildProductKnowledgeText`
- chunk text
- delete old chunks for the source
- call `embedText` for each chunk
- insert `rag_chunks`
- mark source `needs_reindex` on Gemini failure

Use metadata shape:

```js
{
  productId,
  slug,
  category,
  gender,
  price,
  availableSizes,
  availableColors,
  totalStock
}
```

- [ ] **Step 4: Implement retrieval**

`ragRetrieval.service.js` should:

- embed the user message
- query active chunks ordered by cosine distance
- join product rows for product chunks
- apply price/size/gender/category filters after retrieval
- return unique products mapped to the existing product card shape
- return document sources for policy answers

Use SQL pattern:

```sql
SELECT id, source_type, source_id, title, content, metadata, 1 - (embedding <=> $1::vector) AS score
FROM rag_chunks
WHERE status = 'active'
ORDER BY embedding <=> $1::vector
LIMIT $2
```

- [ ] **Step 5: Implement RAG answer service**

`rag.service.js` should:

- classify trivial greeting messages
- parse budget/size/gender/category/result count by reusing or moving helpers from `ai.service.js`
- call `retrieveContext`
- call `generateGroundedAnswer`
- cap product cards by requested count
- return grounded fallback if no context

For `alo`, return:

```js
{
  answer: 'Em đây, anh muốn tìm giày theo mục đích, size, ngân sách hay hỏi chính sách mua hàng nào?',
  products: [],
  sources: []
}
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test --workspace server
git diff --check
```

Commit:

```bash
git add shoe-store/server/src/modules/rag shoe-store/server/test/rag.test.js shoe-store/CHANGELOG.md
git commit -m "feat: add RAG indexing and retrieval"
```

---

### Task 4: Admin RAG API

**Files:**
- Create: `shoe-store/server/src/modules/rag/rag.routes.js`
- Modify: `shoe-store/server/src/app.js`
- Modify: `shoe-store/server/test/admin.test.js`
- Modify: `shoe-store/CHANGELOG.md`

**Interfaces:**
- Mounts router at `/api/admin/rag`.
- Produces admin endpoints from the spec:
  - `GET /api/admin/rag/overview`
  - `GET /api/admin/rag/documents`
  - `POST /api/admin/rag/documents`
  - `PUT /api/admin/rag/documents/:id`
  - `DELETE /api/admin/rag/documents/:id`
  - `POST /api/admin/rag/reindex`
  - `POST /api/admin/rag/products/:id/reindex`
  - `POST /api/admin/rag/documents/:id/reindex`
  - `POST /api/admin/rag/test`

- [ ] **Step 1: Write failing admin API tests**

In `server/test/admin.test.js`, add:

```js
test('admin can fetch RAG overview', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .get('/api/admin/rag/overview')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);

  assert.equal(typeof response.body.overview.geminiConfigured, 'boolean');
  assert.equal(typeof response.body.overview.documentCount, 'number');
});

test('customer cannot access RAG admin endpoints', async () => {
  const { createApp } = require('../src/app');

  await request(createApp())
    .get('/api/admin/rag/overview')
    .set('Authorization', `Bearer ${customerToken}`)
    .expect(403);
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd shoe-store/server
node --test --require ./test/setup.js test/admin.test.js
```

Expected: FAIL with 404 because routes are not mounted.

- [ ] **Step 3: Implement `rag.routes.js`**

Create a router that imports `requireAuth`, `requireAdmin`, `asyncHandler`, and functions from `rag.service.js` / `ragIndex.service.js`.

Route behavior:

- JSON shape for overview: `{ overview }`
- documents list: `{ documents }`
- created document: status 201 `{ document }`
- deleted document: `{ deleted: true }`
- test query: `{ answer, products, sources, chunks }`

- [ ] **Step 4: Mount in app**

In `server/src/app.js`:

```js
const ragRoutes = require('./modules/rag/rag.routes');
app.use('/api/admin/rag', ragRoutes);
```

The router itself must enforce admin auth.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test --workspace server
git diff --check
```

Commit:

```bash
git add shoe-store/server/src/modules/rag/rag.routes.js shoe-store/server/src/app.js shoe-store/server/test/admin.test.js shoe-store/CHANGELOG.md
git commit -m "feat: add admin RAG API"
```

---

### Task 5: Sync Product Admin Mutations with RAG

**Files:**
- Modify: `shoe-store/server/src/modules/admin/admin.service.js`
- Modify: `shoe-store/server/test/admin.test.js`
- Modify: `shoe-store/CHANGELOG.md`

**Interfaces:**
- `createProduct`, `updateProduct`, `createVariant`, and `updateVariant` trigger best-effort RAG reindex for the affected product.
- Hidden products mark related chunks hidden.

- [ ] **Step 1: Write failing sync tests**

Add tests:

```js
test('updating a product triggers RAG reindex for that product', async () => {
  const { createApp } = require('../src/app');

  await request(createApp())
    .patch('/api/admin/products/12')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ description: 'Mô tả mới cho giày trail chống trượt.' })
    .expect(200);

  assert.equal(ragReindexCalls.includes(12), true);
});
```

Mock `ragIndex.service.js` in the test so no network call is made.

- [ ] **Step 2: Run failing test**

Run:

```bash
cd shoe-store/server
node --test --require ./test/setup.js test/admin.test.js
```

Expected: FAIL because admin product mutations do not call RAG reindex.

- [ ] **Step 3: Add best-effort reindex helper**

In `admin.service.js`:

```js
async function reindexProductBestEffort(productId) {
  try {
    const { reindexProduct } = require('../rag/ragIndex.service');
    await reindexProduct(productId);
  } catch (_error) {
    await query(
      `UPDATE rag_chunks SET status = 'needs_reindex', updated_at = NOW() WHERE source_type = 'product' AND source_id = $1`,
      [productId]
    );
  }
}
```

Call this after product/variant mutations complete. Do not fail the product save if Gemini indexing fails.

- [ ] **Step 4: Handle hidden products**

When status changes to `hidden`, mark chunks hidden:

```sql
UPDATE rag_chunks
SET status = 'hidden', updated_at = NOW()
WHERE source_type = 'product' AND source_id = $1
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test --workspace server
git diff --check
```

Commit:

```bash
git add shoe-store/server/src/modules/admin/admin.service.js shoe-store/server/test/admin.test.js shoe-store/CHANGELOG.md
git commit -m "feat: sync product changes with RAG"
```

---

### Task 6: Switch Customer AI Chat to RAG and Stop Chat Persistence

**Files:**
- Modify: `shoe-store/server/src/modules/ai/ai.service.js`
- Modify: `shoe-store/server/test/ai.test.js`
- Modify: `shoe-store/CHANGELOG.md`

**Interfaces:**
- `/api/ai/chat` returns `{ answer, products, sources }`.
- The assistant no longer inserts into `ai_chat_messages`.

- [ ] **Step 1: Write failing AI tests**

In `server/test/ai.test.js`, add:

```js
test('does not persist casual AI chat messages', async () => {
  const { createApp } = require('../src/app');

  await request(createApp())
    .post('/api/ai/chat')
    .set('Authorization', `Bearer ${tokenFor(1)}`)
    .send({ message: 'alo' })
    .expect(200);

  assert.equal(storedMessages.length, 0);
});

test('returns no product cards for policy-only RAG answer', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .post('/api/ai/chat')
    .set('Authorization', `Bearer ${tokenFor(1)}`)
    .send({ message: 'Shop đổi trả như thế nào?' })
    .expect(200);

  assert.equal(response.body.products.length, 0);
  assert.match(response.body.answer, /đổi trả/i);
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
cd shoe-store/server
node --test --require ./test/setup.js test/ai.test.js
```

Expected: FAIL because current service writes to `ai_chat_messages` and does not call RAG.

- [ ] **Step 3: Replace advisor internals**

In `ai.service.js`, keep exported helper functions if tests rely on them, but change `adviseProducts`:

```js
const { answerWithRag } = require('../rag/rag.service');

async function adviseProducts({ user, message }) {
  const cleanedMessage = cleanMessage(message);
  if (!cleanedMessage) {
    throw new HttpError(400, 'Message is required');
  }

  return answerWithRag({ user, message: cleanedMessage });
}
```

Remove `storeMessage` calls from the customer assistant flow.

- [ ] **Step 4: Keep fallback compatibility**

If RAG tables are missing or Gemini is not configured, `answerWithRag` should return a clear fallback:

```text
Hiện trợ lý AI chưa được cấu hình đầy đủ. Anh có thể xem sản phẩm trên trang danh sách hoặc quay lại sau khi admin bật Gemini.
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test --workspace server
git diff --check
```

Commit:

```bash
git add shoe-store/server/src/modules/ai/ai.service.js shoe-store/server/test/ai.test.js shoe-store/CHANGELOG.md
git commit -m "feat: route customer assistant through RAG"
```

---

### Task 7: Admin RAG Page

**Files:**
- Create: `shoe-store/client/src/pages/admin/AdminRagPage.jsx`
- Modify: `shoe-store/client/src/pages/admin/AdminLayout.jsx`
- Modify: `shoe-store/client/src/App.jsx`
- Modify: `shoe-store/client/src/styles.css`
- Modify: `shoe-store/client/test/admin-flow.test.jsx`
- Modify: `shoe-store/CHANGELOG.md`

**Interfaces:**
- Adds route `/admin/rag`.
- Adds nav item `Kho tri thức AI`.
- Uses `apiClient` with admin JWT.

- [ ] **Step 1: Write failing frontend tests**

In `client/test/admin-flow.test.jsx`, add:

```jsx
it('shows RAG knowledge page in admin navigation', async () => {
  renderApp('/admin');

  expect(await screen.findByText('Kho tri thức AI')).toBeTruthy();
});

it('renders RAG overview, policy documents, and test query UI', async () => {
  renderApp('/admin/rag');

  expect(await screen.findByText('Tổng quan tri thức')).toBeTruthy();
  expect(screen.getByText('Chính sách')).toBeTruthy();
  expect(screen.getByText('Kiểm thử truy vấn')).toBeTruthy();
});
```

- [ ] **Step 2: Run failing frontend test**

Run:

```bash
cd shoe-store/client
npm test -- admin-flow.test.jsx
```

Expected: FAIL because page/route/nav do not exist.

- [ ] **Step 3: Add route and nav**

In `App.jsx` import `AdminRagPage` and add:

```jsx
{
  path: 'rag',
  element: <AdminRagPage />
}
```

In `AdminLayout.jsx`, add a nav item using a lucide icon such as `BrainCircuit`:

```js
{ to: '/admin/rag', label: 'Kho tri thức AI', icon: BrainCircuit }
```

- [ ] **Step 4: Implement `AdminRagPage.jsx`**

The page should:

- fetch `/api/admin/rag/overview`
- fetch `/api/admin/rag/documents`
- show config/status cards
- list policy documents
- provide create/edit/delete form
- provide reindex buttons
- provide test query form
- show answer and sources

Use existing admin CSS patterns; do not add a new UI framework.

- [ ] **Step 5: Add scoped CSS**

Add classes such as:

```css
.rag-admin-grid {}
.rag-status-card {}
.rag-document-list {}
.rag-test-panel {}
.rag-source-list {}
```

Keep styles scoped to admin RAG page and avoid changing existing hero/theme hunk unless necessary.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test --workspace client
npm run build
git diff --check
```

Commit:

```bash
git add shoe-store/client/src/pages/admin/AdminRagPage.jsx shoe-store/client/src/pages/admin/AdminLayout.jsx shoe-store/client/src/App.jsx shoe-store/client/src/styles.css shoe-store/client/test/admin-flow.test.jsx shoe-store/CHANGELOG.md
git commit -m "feat: add admin RAG dashboard"
```

---

### Task 8: Customer Assistant RAG UI Behavior

**Files:**
- Modify: `shoe-store/client/src/components/AiAssistant.jsx`
- Modify: `shoe-store/client/test/customer-flow.test.jsx`
- Modify: `shoe-store/CHANGELOG.md`

**Interfaces:**
- Customer assistant displays policy answers without product cards.
- Customer assistant displays product cards only when returned by API.
- Customer assistant preserves current chat UI and frontend-only message state.

- [ ] **Step 1: Write failing customer tests**

In `customer-flow.test.jsx`, add:

```jsx
it('shows policy RAG answers without product recommendations', async () => {
  mockApi('/api/ai/chat', {
    answer: 'Solely hỗ trợ đổi trả theo điều kiện sản phẩm còn nguyên tem.',
    products: [],
    sources: [{ type: 'document', title: 'Đổi trả' }]
  });

  renderCustomerHome();
  await askAssistant('Shop đổi trả như thế nào?');

  expect(await screen.findByText(/hỗ trợ đổi trả/i)).toBeTruthy();
  expect(screen.queryByText('Sản phẩm gợi ý')).toBeNull();
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
cd shoe-store/client
npm test -- customer-flow.test.jsx
```

Expected: FAIL if the component assumes every answer has recommendations.

- [ ] **Step 3: Update component rendering**

In `AiAssistant.jsx`:

- accept `sources` from API response
- keep sources internal unless useful for minimal display
- render product recommendations only when `products.length > 0`
- keep messages in React state only
- do not add persistence or history endpoints

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm test --workspace client
npm run build
git diff --check
```

Commit:

```bash
git add shoe-store/client/src/components/AiAssistant.jsx shoe-store/client/test/customer-flow.test.jsx shoe-store/CHANGELOG.md
git commit -m "feat: support policy answers in assistant"
```

---

### Task 9: End-to-End Verification and Documentation

**Files:**
- Modify: `shoe-store/README.md`
- Modify: `shoe-store/CHANGELOG.md`

**Interfaces:**
- Documents local setup, Gemini env setup, DB setup, RAG reindex, and admin usage.

- [ ] **Step 1: Update README**

Document:

```bash
cd shoe-store
npm install
```

Server env:

```env
DATABASE_URL=postgres://...
JWT_SECRET=...
GEMINI_API_KEY=...
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS=768
GEMINI_CHAT_MODEL=gemini-2.5-flash
RAG_TOP_K=6
```

Commands:

```bash
npm run db:setup
npm run dev
npm test
npm run build
```

Add note: never commit Gemini keys; set secrets in `server/.env` locally and deployment env in production.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run build
git diff --check
```

If PostgreSQL with pgvector is available, also run:

```bash
npm run db:setup
```

Then log into admin and smoke:

- `/admin/rag` renders.
- Overview loads.
- Create a policy document.
- Reindex a document.
- Test "Shop đổi trả thế nào?"
- Customer chat "giày leo núi nam dưới 3 triệu" returns trail products.

- [ ] **Step 3: Commit docs**

Commit:

```bash
git add shoe-store/README.md shoe-store/CHANGELOG.md
git commit -m "docs: document RAG setup"
```

---

## Plan Self-Review

- Spec coverage: schema, Gemini, admin API, admin UI, product sync, customer RAG, no chat persistence, error handling, security, tests, and rollout are covered by Tasks 1-9.
- Placeholder scan: each task has explicit files, interfaces, test commands, implementation direction, verification, and commit steps.
- Type/interface consistency: service names are stable across tasks: `embedText`, `generateGroundedAnswer`, `chunkText`, `buildProductKnowledgeText`, `reindexProduct`, `reindexDocument`, `reindexAll`, `retrieveContext`, and `answerWithRag`.
- Scope decision: file upload parsing and durable customer chat history stay out of scope for this plan.
