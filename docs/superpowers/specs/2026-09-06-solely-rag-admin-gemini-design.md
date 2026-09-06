# Solely RAG Admin Gemini Design

## Status

Approved for specification on 2026-09-06. This document defines the architecture for a Gemini-powered RAG knowledge system in the Solely shoe store MVP.

## Context

Solely currently has a shopping assistant that filters products with keyword/category rules and can rank filtered products with OpenAI when configured. That flow is useful for direct product recommendations, but it is not a full RAG system:

- Product retrieval is mostly SQL text matching, not semantic vector retrieval.
- Product data has been enriched to 20 RAG-ready products, but it is not chunked or embedded.
- The assistant cannot answer store knowledge questions such as ordering steps, COD payment, shipping, return policy, terms, warranty, or size guidance from a managed knowledge base.
- The current `ai_chat_messages` table stores chat messages, but the product assistant does not need durable chat history for casual visitors.

The next version should turn the assistant into a knowledge-grounded chatbot while giving admins a dashboard page to manage and test the RAG data.

## Goals

- Build a Gemini-powered RAG flow for customer questions about products and store policies.
- Add an admin page at `/admin/rag` for managing the AI knowledge base.
- Index both product data and admin-managed policy documents into vector chunks.
- Keep product knowledge synchronized when products are created, updated, hidden, or deleted.
- Return answers grounded in retrieved context, with product cards only when the answer uses product sources.
- Avoid storing casual chat history in `ai_chat_messages`.
- Keep the existing stack: React, Vite, Node.js, Express, PostgreSQL, JWT auth, and admin/customer roles.

## Non-Goals

- No multi-tenant RAG.
- No PDF, DOCX, image, or file upload parsing in this phase.
- No streaming responses in this phase.
- No persistent customer conversation history in this phase.
- No replacement of the existing product, cart, order, or auth architecture.
- No frontend exposure of Gemini API keys.

## Recommended Approach

Use a unified knowledge model:

- `rag_documents` stores admin-managed documents such as policies, terms, ordering instructions, shipping, returns, warranty, and size guides.
- `rag_chunks` stores searchable chunks for both `product` and `document` sources.
- Product chunks are generated from the existing `products`, `product_images`, and `product_variants` tables.
- Document chunks are generated from admin-created policy documents.
- Gemini creates embeddings for chunks and customer questions.
- PostgreSQL `pgvector` performs top-K semantic retrieval.
- Gemini generates the final Vietnamese answer using only retrieved context.

This keeps the system small enough for the MVP while supporting real RAG behavior and admin control.

## Data Model

### Extensions

PostgreSQL must enable pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

If the deployment database does not support pgvector, RAG setup must fail clearly in admin/status endpoints instead of silently falling back to weak keyword retrieval.

### `rag_documents`

Stores admin-authored knowledge entries.

Fields:

- `id BIGSERIAL PRIMARY KEY`
- `title TEXT NOT NULL`
- `slug TEXT NOT NULL UNIQUE`
- `document_type TEXT NOT NULL`
- `content TEXT NOT NULL`
- `status TEXT NOT NULL DEFAULT 'active'`
- `last_indexed_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Allowed `document_type` values:

- `ordering`
- `payment`
- `shipping`
- `returns`
- `warranty`
- `terms`
- `size_guide`
- `general`

`status` values:

- `active`: available to retrieval
- `hidden`: not available to retrieval
- `needs_reindex`: content exists but chunks are stale or missing

### `rag_chunks`

Stores embedded chunks for retrieval.

Fields:

- `id BIGSERIAL PRIMARY KEY`
- `source_type TEXT NOT NULL`
- `source_id BIGINT NOT NULL`
- `chunk_index INTEGER NOT NULL`
- `title TEXT NOT NULL`
- `content TEXT NOT NULL`
- `metadata JSONB NOT NULL DEFAULT '{}'::jsonb`
- `embedding vector(768)`
- `embedding_model TEXT NOT NULL`
- `status TEXT NOT NULL DEFAULT 'active'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Allowed `source_type` values:

- `product`
- `document`

Indexes:

- `(source_type, source_id)`
- `(status)`
- vector similarity index on `embedding` using pgvector

The default embedding dimension is `768`, controlled by `GEMINI_EMBEDDING_DIMENSIONS=768`. If this value changes, the schema and all stored embeddings must be recreated together.

## Default Knowledge Documents

Seed data should include initial active documents so the assistant can answer policy questions before admins add custom text:

- `Cách đặt hàng`: browsing products, selecting size/color, adding to cart, checkout.
- `Thanh toán COD`: payment method currently supported by MVP.
- `Vận chuyển`: delivery information, address requirements, tracking via order history.
- `Đổi trả`: conditions for return/exchange, product condition, contact instruction.
- `Bảo hành`: coverage for manufacturing defects and exclusions.
- `Hướng dẫn chọn size`: how to choose size and ask the assistant for fit guidance.
- `Điều khoản mua hàng`: order confirmation, stock availability, cancellation caveats.

The text must be Vietnamese and concise but specific enough for retrieval.

## Product Knowledge Generation

For each active product, generate one or more chunks containing:

- product name, slug, brand, category, gender
- base price in VND
- enriched description
- intended use cases
- material, cushioning, grip, fit, and terrain hints from description
- available sizes and colors with positive stock
- total stock
- whether it is featured

Example product chunk shape:

```text
Sản phẩm: Solely Trail Guard
Danh mục: trail
Giới tính: men
Giá: 2.490.000 ₫
Mục đích: trekking cuối tuần, đi rừng nhẹ và đường mòn khô...
Size còn hàng: 42, 43
Màu còn hàng: Olive, Gray
Tồn kho: 12
```

Hidden products and products with no active context should not be returned to customer RAG answers.

## Product Sync Behavior

Product CRUD must keep RAG knowledge consistent:

- Create product: save product first, then create product chunks and embeddings.
- Update product: replace old product chunks for that product with new chunks.
- Hide product: mark product chunks `hidden`.
- Delete product: delete product chunks for that product.
- Gemini failure: product mutation still succeeds, but RAG status becomes `needs_reindex`.
- Missing Gemini key: product mutation still succeeds, but admin page shows that indexing is unavailable.

The system should expose a manual reindex action so admin can recover from failed indexing without editing the product again.

## Gemini Integration

Environment variables:

```env
GEMINI_API_KEY=
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS=768
GEMINI_CHAT_MODEL=gemini-2.5-flash
RAG_TOP_K=6
```

Rules:

- Gemini API calls happen only in the Express backend.
- Frontend never receives or stores `GEMINI_API_KEY`.
- Missing `GEMINI_API_KEY` must produce clear admin status and a graceful customer fallback.
- The answer prompt must require Vietnamese output and forbid invented products, policies, prices, stock, discounts, and delivery promises.

## RAG Retrieval Flow

For `POST /api/ai/chat`:

1. Validate JWT user.
2. Clean the message.
3. Classify trivial messages such as `alo`, `hello`, `hi`, or very short non-shopping greetings.
4. For trivial messages, return a short helper response and no product cards.
5. Parse structured filters from the message:
   - budget
   - size
   - gender
   - product intent/category such as `trail`, `running`, `walking`, `sneakers`, `boots`, `training`
   - requested result count
6. Create a query embedding with Gemini.
7. Retrieve top-K active chunks from `rag_chunks`.
8. Apply structured filters where relevant:
   - product chunks must respect active product status.
   - product price, size, gender, and category filters must narrow product results.
   - policy questions should be allowed to retrieve document chunks without product cards.
9. Build context from retrieved chunks.
10. Ask Gemini to answer using only that context.
11. Return:
   - `answer`
   - `products`
   - `sources`

`sources` should include enough data for admin/debug visibility:

```json
{
  "type": "product",
  "id": 12,
  "title": "Solely Trail Guard",
  "score": 0.82
}
```

Customer UI does not need to show source scores, but admin test UI should.

## Answer Rules

The chatbot must:

- Answer in Vietnamese.
- Ask a follow-up question for greetings or vague messages.
- Return no product cards for pure policy questions.
- Return product cards only for products included in retrieved product chunks.
- Respect requested counts such as "2 sản phẩm".
- Say it does not have enough data when retrieval is empty.
- Mention COD as the supported payment method unless policies are later updated.
- Avoid creating promises about delivery time, warranty, discounts, or stock that do not exist in context.

## Admin API

All endpoints require admin role.

### Overview

`GET /api/admin/rag/overview`

Returns:

- document count by status
- chunk count by source type
- indexed product count
- stale product count
- last indexed time
- Gemini config status
- pgvector availability status

### Documents

- `GET /api/admin/rag/documents`
- `POST /api/admin/rag/documents`
- `PUT /api/admin/rag/documents/:id`
- `DELETE /api/admin/rag/documents/:id`

Creating or updating an active document should reindex that document. Deleting a document should delete its chunks.

### Reindexing

- `POST /api/admin/rag/reindex`
- `POST /api/admin/rag/products/:id/reindex`
- `POST /api/admin/rag/documents/:id/reindex`

Bulk reindex refreshes all active products and all active documents.

### Test Query

`POST /api/admin/rag/test`

Accepts:

```json
{
  "message": "Shop đổi trả như thế nào?"
}
```

Returns:

- answer
- retrieved chunks
- sources
- product cards when relevant

## Admin UI

Add page:

```text
/admin/rag
```

Navigation label:

```text
Kho tri thức AI
```

Sections:

- **Tổng quan**: Gemini status, pgvector status, document count, chunk count, product indexed count, stale count.
- **Sản phẩm**: product index status, reindex all products, reindex one product.
- **Chính sách**: list/create/edit/delete policy documents.
- **Kiểm thử**: input question, run RAG test, show answer and retrieved sources.

The admin UI should follow the existing admin dashboard style and should not render storefront header/footer.

## Customer UI

The existing floating shopping assistant stays as the customer entry point.

Changes:

- It calls the RAG-backed `/api/ai/chat`.
- It keeps messages only in frontend state for the active browser session.
- It displays product cards only when the API returns products.
- It shows policy answers as assistant text without product cards.
- It handles missing Gemini configuration with a helpful fallback message.

## Removing Chat Persistence

The RAG assistant should stop writing to `ai_chat_messages`.

Implementation options:

- Keep the `ai_chat_messages` table temporarily for migration compatibility, but stop using it.
- Remove the table in a later database cleanup once no code references it.

This spec chooses the safer MVP path: stop using `ai_chat_messages` in the assistant now, and leave physical table removal as a later cleanup task.

## Error Handling

- Missing `GEMINI_API_KEY`: admin overview reports not configured; customer answer falls back to a concise message asking admin to configure AI.
- pgvector missing: admin overview reports migration/setup problem; indexing and semantic retrieval return clear errors.
- Gemini embedding failure: source status becomes `needs_reindex`.
- Gemini answer failure: return a grounded fallback based on retrieved chunks rather than a fabricated answer.
- Empty retrieval: return "Hiện em chưa có đủ dữ liệu để trả lời chính xác câu này."

## Security

- Admin RAG endpoints require JWT and role `admin`.
- Customer chat endpoint requires JWT as currently implemented.
- Gemini API key must remain server-side only.
- RAG documents are internal admin-managed content; customers can query them only through the assistant.
- The assistant must not expose raw environment variables, stack traces, SQL errors, or internal admin-only metadata.

## Testing Requirements

Backend tests:

- Schema defines `rag_documents`, `rag_chunks`, pgvector extension setup, and indexes.
- Seed includes default policy documents.
- Reindex creates chunks for at least 20 products.
- Product update marks or refreshes related chunks.
- Product hide/delete removes products from customer retrieval.
- Policy create/update/delete syncs document chunks.
- Customer asks "alo" and receives no product cards.
- Customer asks "Shop đổi trả như thế nào?" and retrieves policy chunks.
- Customer asks "giày leo núi nam dưới 3 triệu" and retrieves trail products.
- Customer asks "2 sản phẩm" and receives at most 2 product cards.
- Missing Gemini key returns clear admin/customer fallback.

Frontend tests:

- Admin nav shows `Kho tri thức AI`.
- `/admin/rag` renders overview, products, policy documents, and test sections.
- Admin can create/edit/delete policy document through mocked API.
- Admin test query shows retrieved sources.
- Customer assistant renders policy answer without product cards.
- Customer assistant renders product cards only when products are returned.

Verification commands:

```bash
npm test
npm run build
git diff --check
```

## Rollout

1. Add schema and seed changes.
2. Add Gemini env examples and README setup.
3. Implement RAG indexing and admin APIs.
4. Implement admin UI.
5. Switch customer assistant to RAG.
6. Run full test/build/diff verification.
7. In real PostgreSQL, run the new schema migration and then run the reindex command.

## Open Operational Notes

- Gemini free tier limits may throttle bulk reindexing; the implementation should process records sequentially and fail clearly.
- Changing embedding model or dimension requires deleting and rebuilding all `rag_chunks`.
- Production deployment must set `GEMINI_API_KEY` before RAG answers can use Gemini.
- If the current PostgreSQL provider does not support pgvector, RAG cannot work correctly until pgvector support is available.
