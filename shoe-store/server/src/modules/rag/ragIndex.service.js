const { query } = require('../../db/pool');
const { embedText } = require('./gemini.client');
const { buildProductKnowledgeText, chunkText } = require('./ragText.service');

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';

function vectorLiteral(values) {
  return `[${values.map((value) => Number(value) || 0).join(',')}]`;
}

function toNumber(value) {
  return value === null || value === undefined ? value : Number(value);
}

function mapProduct(row) {
  if (!row) return null;

  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    description: row.description,
    brand: row.brand,
    category: row.category,
    gender: row.gender,
    price: toNumber(row.price),
    imageUrl: row.imageUrl,
    availableSizes: row.availableSizes || [],
    availableColors: row.availableColors || [],
    totalStock: Number(row.totalStock || 0)
  };
}

async function loadProduct(productId) {
  const result = await query(
    `
      SELECT
        p.id,
        p.name,
        p.slug,
        p.description,
        p.brand,
        p.category,
        p.gender,
        p.base_price AS "price",
        primary_image.image_url AS "imageUrl",
        COALESCE(variant_summary.available_sizes, ARRAY[]::TEXT[]) AS "availableSizes",
        COALESCE(variant_summary.available_colors, ARRAY[]::TEXT[]) AS "availableColors",
        COALESCE(variant_summary.total_stock, 0) AS "totalStock"
      FROM products p
      LEFT JOIN LATERAL (
        SELECT pi.image_url
        FROM product_images pi
        WHERE pi.product_id = p.id
        ORDER BY pi.sort_order ASC, pi.id ASC
        LIMIT 1
      ) primary_image ON true
      LEFT JOIN LATERAL (
        SELECT
          ARRAY_AGG(DISTINCT pv.size ORDER BY pv.size) FILTER (WHERE pv.stock_quantity > 0) AS available_sizes,
          ARRAY_AGG(DISTINCT pv.color ORDER BY pv.color) FILTER (WHERE pv.stock_quantity > 0) AS available_colors,
          SUM(pv.stock_quantity) FILTER (WHERE pv.stock_quantity > 0) AS total_stock
        FROM product_variants pv
        WHERE pv.product_id = p.id
      ) variant_summary ON true
      WHERE p.id = $1
        AND p.status = 'active'
      GROUP BY p.id, primary_image.image_url, variant_summary.available_sizes, variant_summary.available_colors, variant_summary.total_stock
    `,
    [productId]
  );

  return mapProduct(result.rows[0]);
}

async function loadDocument(documentId) {
  const result = await query(
    `
      SELECT id, title, slug, document_type, content, status
      FROM rag_documents
      WHERE id = $1
        AND status <> 'hidden'
    `,
    [documentId]
  );

  return result.rows[0] || null;
}

async function replaceChunks({ sourceType, sourceId, chunks, metadata }) {
  await query('DELETE FROM rag_chunks WHERE source_type = $1 AND source_id = $2', [sourceType, sourceId]);

  for (const chunk of chunks) {
    const embedding = await embedText(`${chunk.title}\n${chunk.content}`);
    await query(
      `
        INSERT INTO rag_chunks (
          source_type,
          source_id,
          chunk_index,
          title,
          content,
          metadata,
          embedding,
          embedding_model,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::vector, $8, 'active')
      `,
      [
        sourceType,
        sourceId,
        chunk.chunkIndex,
        chunk.title,
        chunk.content,
        JSON.stringify(metadata),
        vectorLiteral(embedding),
        EMBEDDING_MODEL
      ]
    );
  }
}

async function createNeedsReindexMarker({ sourceType, sourceId, title, content, metadata }) {
  await query('DELETE FROM rag_chunks WHERE source_type = $1 AND source_id = $2', [sourceType, sourceId]);
  await query(
    `
      INSERT INTO rag_chunks (
        source_type,
        source_id,
        chunk_index,
        title,
        content,
        metadata,
        embedding_model,
        status
      )
      VALUES ($1, $2, 0, $3, $4, $5::jsonb, $6, $7)
    `,
    [
      sourceType,
      sourceId,
      title,
      content,
      JSON.stringify(metadata),
      EMBEDDING_MODEL,
      'needs_reindex'
    ]
  );
}

async function markNeedsReindex(sourceType, sourceId, source = {}) {
  if (sourceType === 'document') {
    await query("UPDATE rag_documents SET status = 'needs_reindex', updated_at = NOW() WHERE id = $1", [sourceId]);
    return;
  }

  await createNeedsReindexMarker({
    sourceType,
    sourceId,
    title: source.title || `Product ${sourceId}`,
    content: 'Nguồn sản phẩm cần reindex sau lỗi Gemini embedding.',
    metadata: source.metadata || { productId: sourceId }
  });
}

async function markIndexed(sourceType, sourceId) {
  if (sourceType === 'document') {
    await query("UPDATE rag_documents SET status = 'active', last_indexed_at = NOW(), updated_at = NOW() WHERE id = $1", [sourceId]);
  }
}

async function reindexProduct(productId) {
  const product = await loadProduct(productId);
  if (!product) {
    return { status: 'not_found', chunksIndexed: 0 };
  }

  const metadata = {
    productId: product.id,
    slug: product.slug,
    category: product.category,
    gender: product.gender,
    price: product.price,
    availableSizes: product.availableSizes,
    availableColors: product.availableColors,
    totalStock: product.totalStock
  };
  const chunks = chunkText({ title: product.name, content: buildProductKnowledgeText(product) });

  try {
    await replaceChunks({ sourceType: 'product', sourceId: product.id, chunks, metadata });
    return { status: 'indexed', chunksIndexed: chunks.length };
  } catch (error) {
    await markNeedsReindex('product', product.id, { title: product.name, metadata });
    throw error;
  }
}

async function reindexDocument(documentId) {
  const document = await loadDocument(documentId);
  if (!document) {
    return { status: 'not_found', chunksIndexed: 0 };
  }

  const metadata = {
    documentId: Number(document.id),
    slug: document.slug,
    documentType: document.document_type
  };
  const chunks = chunkText({ title: document.title, content: document.content });

  try {
    await replaceChunks({ sourceType: 'document', sourceId: Number(document.id), chunks, metadata });
    await markIndexed('document', Number(document.id));
    return { status: 'indexed', chunksIndexed: chunks.length };
  } catch (error) {
    await markNeedsReindex('document', Number(document.id));
    throw error;
  }
}

async function reindexAll() {
  const [productsResult, documentsResult] = await Promise.all([
    query("SELECT id FROM products WHERE status = 'active' ORDER BY id ASC"),
    query("SELECT id FROM rag_documents WHERE status = 'active' ORDER BY id ASC")
  ]);
  const summary = { productsIndexed: 0, documentsIndexed: 0, failed: [] };

  for (const product of productsResult.rows) {
    try {
      const result = await reindexProduct(Number(product.id));
      if (result.status === 'indexed') summary.productsIndexed += 1;
    } catch (error) {
      summary.failed.push({ type: 'product', id: Number(product.id), error: error.message });
    }
  }

  for (const document of documentsResult.rows) {
    try {
      const result = await reindexDocument(Number(document.id));
      if (result.status === 'indexed') summary.documentsIndexed += 1;
    } catch (error) {
      summary.failed.push({ type: 'document', id: Number(document.id), error: error.message });
    }
  }

  return summary;
}

module.exports = {
  reindexProduct,
  reindexDocument,
  reindexAll
};
