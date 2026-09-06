# Task 2 Report: Gemini Client and RAG Text Helpers

## Status

Implemented and committed Task 2 for the Solely RAG Admin Gemini plan.

## Scope Completed

- Added `shoe-store/server/src/modules/rag/gemini.client.js`.
- Added `isGeminiConfigured()` for server-side Gemini configuration checks.
- Added `embedText(text)` using the Gemini `embedContent` endpoint with defaults:
  - `gemini-embedding-001`
  - `768` dimensions
- Added `generateGroundedAnswer({ message, context, products })` using the Gemini `generateContent` endpoint with default chat model `gemini-2.5-flash`.
- Kept Gemini calls isolated to backend service code only.
- Added grounded prompt rules in Vietnamese so answers must use provided RAG context/products and avoid unsupported product, price, stock, policy, promotion, or commitment claims.
- Added `shoe-store/server/src/modules/rag/ragText.service.js`.
- Added `buildProductKnowledgeText(product)` to produce Vietnamese product knowledge text.
- Added `chunkText({ title, content, maxLength })` to normalize and split long content into indexed chunks.
- Added `shoe-store/server/test/rag.test.js` with the required missing-key and Vietnamese chunking tests.
- Updated `shoe-store/server/src/config/env.js` with Gemini/RAG env defaults.
- Updated `shoe-store/server/.env.example` with:
  - `GEMINI_API_KEY=`
  - `GEMINI_EMBEDDING_MODEL=gemini-embedding-001`
  - `GEMINI_EMBEDDING_DIMENSIONS=768`
  - `GEMINI_CHAT_MODEL=gemini-2.5-flash`
  - `RAG_TOP_K=6`
- Updated `shoe-store/README.md` to document backend-only Gemini key setup and warn not to commit keys.
- Updated `shoe-store/CHANGELOG.md` in Vietnamese under `## Chưa phát hành`.

## TDD Evidence

1. Added failing tests first in `shoe-store/server/test/rag.test.js`.
2. Ran focused test before implementation:

```bash
cd shoe-store/server
node --test --require ./test/setup.js test/rag.test.js
```

Result: failed as expected because `../src/modules/rag/gemini.client` and `../src/modules/rag/ragText.service` did not exist.

3. Implemented the Gemini client, RAG text helpers, env config, env example, README, and changelog changes.
4. Re-ran focused test:

```bash
cd shoe-store/server
node --test --require ./test/setup.js test/rag.test.js
```

Result: passed, 2/2 tests.

## Verification

Ran:

```bash
npm test --workspace server
```

Result: passed, 63/63 server tests.

Ran:

```bash
git diff --check
```

Result: passed with exit code 0 and no whitespace errors.

## Files Changed

- `shoe-store/server/src/modules/rag/gemini.client.js`
- `shoe-store/server/src/modules/rag/ragText.service.js`
- `shoe-store/server/test/rag.test.js`
- `shoe-store/server/src/config/env.js`
- `shoe-store/server/.env.example`
- `shoe-store/README.md`
- `shoe-store/CHANGELOG.md`
- `.superpowers/sdd/2026-09-06-solely-rag-admin-gemini/task-2-report.md`

## Files Intentionally Left Unstaged/Untouched

- `shoe-store/DEVELOPMENT_PROMPT.md`
- `shoe-store/client/src/styles.css`

These were dirty before Task 2 work and are unrelated to this task.

## Out of Scope

- No indexing service implementation.
- No retrieval service implementation.
- No admin API implementation.
- No admin UI implementation.
- No customer AI route switch to RAG yet.
- No removal of `ai_chat_messages`.
- No real Gemini API key was written to files.

## Concerns

- Real embedding/generation behavior still depends on a valid `GEMINI_API_KEY` in `server/.env` or the backend deployment environment.
- Live Gemini API calls were not executed because this task must not use or persist a real secret.
