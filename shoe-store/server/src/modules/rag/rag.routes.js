const express = require('express');
const { query } = require('../../db/pool');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/asyncHandler');
const { HttpError } = require('../../utils/httpError');
const { answerWithRag } = require('./rag.service');
const { reindexAll, reindexProduct, reindexDocument } = require('./ragIndex.service');
const { isGeminiConfigured } = require('./gemini.client');

const router = express.Router();

const DOCUMENT_TYPES = new Set(['ordering', 'payment', 'shipping', 'returns', 'warranty', 'terms', 'size_guide', 'general']);
const DOCUMENT_STATUSES = new Set(['active', 'hidden', 'needs_reindex']);

router.use(requireAuth, requireAdmin);

function cleanString(value) {
  return String(value || '').trim();
}

function mapDocument(row) {
  if (!row) return null;

  return {
    id: Number(row.id),
    title: row.title,
    slug: row.slug,
    documentType: row.document_type,
    content: row.content,
    status: row.status,
    lastIndexedAt: row.last_indexed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function validateDocumentInput(input, { partial = false } = {}) {
  const output = {};

  if (!partial || Object.prototype.hasOwnProperty.call(input, 'title')) {
    output.title = cleanString(input.title);
    if (!output.title) throw new HttpError(400, 'Title is required');
  }

  if (!partial || Object.prototype.hasOwnProperty.call(input, 'slug')) {
    output.slug = cleanString(input.slug);
    if (!output.slug) throw new HttpError(400, 'Slug is required');
  }

  if (!partial || Object.prototype.hasOwnProperty.call(input, 'documentType')) {
    output.documentType = cleanString(input.documentType || input.document_type);
    if (!DOCUMENT_TYPES.has(output.documentType)) throw new HttpError(400, 'Document type is invalid');
  }

  if (!partial || Object.prototype.hasOwnProperty.call(input, 'content')) {
    output.content = cleanString(input.content);
    if (!output.content) throw new HttpError(400, 'Content is required');
  }

  if (Object.prototype.hasOwnProperty.call(input, 'status')) {
    output.status = cleanString(input.status);
    if (!DOCUMENT_STATUSES.has(output.status)) throw new HttpError(400, 'Status is invalid');
  } else if (!partial) {
    output.status = 'active';
  }

  return output;
}

async function getOverview() {
  const result = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM rag_documents WHERE status <> 'hidden') AS document_count,
      (SELECT COUNT(*)::int FROM rag_chunks WHERE status = 'active') AS chunk_count,
      (SELECT COUNT(*)::int FROM rag_chunks WHERE status = 'needs_reindex') AS needs_reindex_count
  `);
  const row = result.rows[0] || {};

  return {
    geminiConfigured: isGeminiConfigured(),
    documentCount: Number(row.document_count || 0),
    chunkCount: Number(row.chunk_count || 0),
    needsReindexCount: Number(row.needs_reindex_count || 0)
  };
}

async function listDocuments() {
  const result = await query(`
    SELECT id, title, slug, document_type, content, status, last_indexed_at, created_at, updated_at
    FROM rag_documents
    ORDER BY updated_at DESC, id DESC
  `);

  return result.rows.map(mapDocument);
}

async function createDocument(input) {
  const document = validateDocumentInput(input);
  const result = await query(
    `
      INSERT INTO rag_documents (title, slug, document_type, content, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, title, slug, document_type, content, status, last_indexed_at, created_at, updated_at
    `,
    [document.title, document.slug, document.documentType, document.content, document.status]
  );

  return mapDocument(result.rows[0]);
}

async function updateDocument(documentId, input) {
  const document = validateDocumentInput(input, { partial: true });
  const fields = [];
  const values = [];

  for (const [column, value] of [
    ['title', document.title],
    ['slug', document.slug],
    ['document_type', document.documentType],
    ['content', document.content],
    ['status', document.status]
  ]) {
    if (value !== undefined) {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    }
  }

  if (!fields.length) throw new HttpError(400, 'No document updates provided');

  values.push(documentId);
  const result = await query(
    `
      UPDATE rag_documents
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING id, title, slug, document_type, content, status, last_indexed_at, created_at, updated_at
    `,
    values
  );

  if (!result.rows[0]) throw new HttpError(404, 'Document not found');
  return mapDocument(result.rows[0]);
}

async function deleteDocument(documentId) {
  await query('DELETE FROM rag_chunks WHERE source_type = $1 AND source_id = $2', ['document', documentId]);
  const result = await query('DELETE FROM rag_documents WHERE id = $1 RETURNING id', [documentId]);
  if (!result.rows[0]) throw new HttpError(404, 'Document not found');
}

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const overview = await getOverview();
    res.json({ overview });
  })
);

router.get(
  '/documents',
  asyncHandler(async (req, res) => {
    const documents = await listDocuments();
    res.json({ documents });
  })
);

router.post(
  '/documents',
  asyncHandler(async (req, res) => {
    const document = await createDocument(req.body || {});
    res.status(201).json({ document });
  })
);

router.put(
  '/documents/:id',
  asyncHandler(async (req, res) => {
    const document = await updateDocument(req.params.id, req.body || {});
    res.json({ document });
  })
);

router.delete(
  '/documents/:id',
  asyncHandler(async (req, res) => {
    await deleteDocument(req.params.id);
    res.json({ deleted: true });
  })
);

router.post(
  '/reindex',
  asyncHandler(async (req, res) => {
    const summary = await reindexAll();
    res.json({ summary });
  })
);

router.post(
  '/products/:id/reindex',
  asyncHandler(async (req, res) => {
    const result = await reindexProduct(req.params.id);
    res.json({ result });
  })
);

router.post(
  '/documents/:id/reindex',
  asyncHandler(async (req, res) => {
    const result = await reindexDocument(req.params.id);
    res.json({ result });
  })
);

router.post(
  '/test',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const result = await answerWithRag({ user: req.user, message: body.message, includeChunks: true });
    res.json({
      answer: result.answer,
      products: result.products,
      sources: result.sources,
      chunks: result.chunks || []
    });
  })
);

module.exports = router;
