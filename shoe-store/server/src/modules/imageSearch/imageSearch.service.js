const { query } = require('../../db/pool');
const { HttpError } = require('../../utils/httpError');
const { calculateVariantPrice } = require('../products/pricing');
const { embedImage, getImageEmbeddingConfig } = require('../rag/gemini.client');

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const CATALOG_IMAGE_TIMEOUT_MS = 10_000;
const IMAGE_SEARCH_THRESHOLD = 0.35;
const MAX_SEARCH_RESULTS = 12;
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const SAFE_INDEX_ERROR = 'Không thể tạo embedding cho ảnh sản phẩm';

const VARIANT_DISPLAYED_PRICE = `CASE
  WHEN COALESCE(source_variant.discount_percent, 0) = 0
    AND source_variant.legacy_pricing_active
    AND to_jsonb(source_variant) ->> 'legacy_price_delta' IS NOT NULL
    THEN GREATEST(
      0,
      ROUND(p.base_price + (to_jsonb(source_variant) ->> 'legacy_price_delta')::NUMERIC)
    )
  ELSE GREATEST(
    0,
    ROUND(
      p.base_price
      * (10000 - ROUND(COALESCE(source_variant.discount_percent, 0) * 100))
      / 10000
    )
  )
END`;

function cleanText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function addParam(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function normalizePriceFilter(filters, field) {
  if (!Object.prototype.hasOwnProperty.call(filters, field)) return null;

  const value = filters[field];
  if (Array.isArray(value) || value === null || value === undefined || String(value).trim() === '') {
    throw new HttpError(400, 'Price filter must be a nonnegative number');
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new HttpError(400, 'Price filter must be a nonnegative number');
  }

  return amount.toFixed(2);
}

function normalizeLimit(limit) {
  const parsed = Number.parseInt(limit, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return MAX_SEARCH_RESULTS;
  return Math.min(parsed, MAX_SEARCH_RESULTS);
}

function vectorLiteral(values) {
  return `[${values.join(',')}]`;
}

function validateImageInput(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new HttpError(400, 'Image file is required');
  }

  if (!SUPPORTED_MIME_TYPES.has(file.mimetype)) {
    throw new HttpError(400, 'Image must be JPEG or PNG');
  }

  const declaredSize = Number(file.size);
  if (file.buffer.length > MAX_IMAGE_BYTES || (Number.isFinite(declaredSize) && declaredSize > MAX_IMAGE_BYTES)) {
    throw new HttpError(400, 'Image must not exceed 8 MB');
  }

  return { data: file.buffer, mimeType: file.mimetype };
}

async function upsertImageEmbedding({ productId, productImageId, embedding, model, status, errorMessage }) {
  await query(
    `
      INSERT INTO product_image_embeddings (
        product_id,
        product_image_id,
        embedding,
        embedding_model,
        status,
        error_message
      )
      VALUES ($1, $2, $3::vector, $4, $5, $6)
      ON CONFLICT (product_image_id, embedding_model) DO UPDATE
      SET
        product_id = EXCLUDED.product_id,
        embedding = EXCLUDED.embedding,
        status = EXCLUDED.status,
        error_message = EXCLUDED.error_message,
        updated_at = NOW()
    `,
    [productId, productImageId, embedding ? vectorLiteral(embedding) : null, model, status, errorMessage]
  );
}

function responseMimeType(response) {
  const contentType = response.headers?.get?.('content-type') || '';
  return contentType.split(';', 1)[0].trim().toLowerCase();
}

async function downloadCatalogImage(imageUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw new Error('Catalog image URL is invalid');
  }
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Catalog image URL must use HTTPS');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CATALOG_IMAGE_TIMEOUT_MS);
  let reader;

  try {
    const response = await fetch(parsedUrl.toString(), { signal: controller.signal });
    if (!response.ok) throw new Error('Catalog image download failed');

    const mimeType = responseMimeType(response);
    if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
      throw new Error('Catalog image must be JPEG or PNG');
    }

    const contentLengthHeader = response.headers?.get?.('content-length');
    const contentLength = contentLengthHeader === null || contentLengthHeader === undefined
      ? null
      : Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      controller.abort();
      throw new Error('Catalog image is too large');
    }

    if (!response.body?.getReader) {
      throw new Error('Catalog image response is not streamable');
    }

    reader = response.body.getReader();
    const chunks = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = Buffer.from(value);
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_IMAGE_BYTES) {
        controller.abort();
        await reader.cancel().catch(() => {});
        throw new Error('Catalog image is too large');
      }
      chunks.push(chunk);
    }

    const data = Buffer.concat(chunks, receivedBytes);
    return validateImageInput({ buffer: data, mimetype: mimeType, size: receivedBytes });
  } finally {
    clearTimeout(timeout);
    reader?.releaseLock?.();
  }
}

async function indexProductImage({ productId, productImageId, imageUrl }) {
  const { model } = getImageEmbeddingConfig();
  let embedding;

  try {
    const image = await downloadCatalogImage(imageUrl);
    embedding = await embedImage(image);
  } catch {
    await upsertImageEmbedding({
      productId,
      productImageId,
      embedding: null,
      model,
      status: 'error',
      errorMessage: SAFE_INDEX_ERROR
    });
    return {
      status: 'error',
      productId,
      productImageId,
      embeddingModel: model,
      errorMessage: SAFE_INDEX_ERROR
    };
  }

  await upsertImageEmbedding({
    productId,
    productImageId,
    embedding,
    model,
    status: 'active',
    errorMessage: null
  });

  return { status: 'active', productId, productImageId, embeddingModel: model };
}

async function reindexRows(rows) {
  const summary = { indexed: 0, failed: 0 };

  for (const row of rows) {
    const result = await indexProductImage({
      productId: Number(row.productId),
      productImageId: Number(row.productImageId),
      imageUrl: row.imageUrl
    });
    if (result.status === 'active') summary.indexed += 1;
    else summary.failed += 1;
  }

  return summary;
}

async function reindexProductImages(productId) {
  const result = await query(
    `
      SELECT
        product_id AS "productId",
        id AS "productImageId",
        image_url AS "imageUrl"
      FROM product_images
      WHERE product_id = $1
      ORDER BY sort_order ASC, id ASC
    `,
    [productId]
  );
  return reindexRows(result.rows);
}

async function reindexAllProductImages() {
  const result = await query(
    `
      SELECT
        pi.product_id AS "productId",
        pi.id AS "productImageId",
        pi.image_url AS "imageUrl"
      FROM product_images pi
      JOIN products p ON p.id = pi.product_id
      WHERE p.status = 'active'
      ORDER BY pi.product_id ASC, pi.sort_order ASC, pi.id ASC
    `
  );
  return reindexRows(result.rows);
}

function buildSearchQuery(embedding, model, filters, limit) {
  const params = [vectorLiteral(embedding), IMAGE_SEARCH_THRESHOLD, model];
  const productConditions = [
    "p.status = 'active'",
    "pie.status = 'active'",
    'pie.embedding IS NOT NULL',
    'pie.embedding_model = $3'
  ];
  const variantConditions = ['source_variant.stock_quantity > 0'];

  for (const field of ['brand', 'gender']) {
    const value = cleanText(filters[field]);
    if (value) productConditions.push(`LOWER(p.${field}) = LOWER(${addParam(params, value)})`);
  }

  const size = cleanText(filters.size);
  if (size) variantConditions.push(`source_variant.size = ${addParam(params, size)}`);

  const color = cleanText(filters.color);
  if (color) variantConditions.push(`LOWER(source_variant.color) = LOWER(${addParam(params, color)})`);

  const minPrice = normalizePriceFilter(filters, 'minPrice');
  if (minPrice !== null) variantConditions.push(`displayed_price >= ${addParam(params, minPrice)}`);

  const maxPrice = normalizePriceFilter(filters, 'maxPrice');
  if (maxPrice !== null) variantConditions.push(`displayed_price <= ${addParam(params, maxPrice)}`);

  productConditions.push(`EXISTS (
    SELECT 1
    FROM (
      SELECT
        source_variant.size,
        source_variant.color,
        source_variant.stock_quantity,
        ${VARIANT_DISPLAYED_PRICE} AS displayed_price
      FROM product_variants source_variant
      WHERE source_variant.product_id = p.id
    ) matching_variant
    WHERE ${variantConditions.map((condition) => condition.replaceAll('source_variant.', 'matching_variant.')).join('\n      AND ')}
  )`);

  const resultLimit = addParam(params, normalizeLimit(limit));
  const defaultVariantConditions = variantConditions.map((condition) => condition.replaceAll('source_variant.', 'pv.'));

  return {
    text: `
      WITH ranked_products AS (
        SELECT
          pie.product_id,
          MAX(1 - (pie.embedding <=> $1::vector)) AS similarity_score
        FROM product_image_embeddings pie
        JOIN product_images matched_image
          ON matched_image.id = pie.product_image_id
          AND matched_image.product_id = pie.product_id
        JOIN products p ON p.id = pie.product_id
        WHERE ${productConditions.join('\n          AND ')}
        GROUP BY pie.product_id
        HAVING MAX(1 - (pie.embedding <=> $1::vector)) >= $2
      )
      SELECT
        p.id,
        p.name,
        p.slug,
        p.brand,
        p.category,
        p.gender,
        p.base_price AS "basePrice",
        primary_image.image_url AS "imageUrl",
        COALESCE(variant_summary.available_sizes, ARRAY[]::TEXT[]) AS "availableSizes",
        COALESCE(variant_summary.available_colors, ARRAY[]::TEXT[]) AS "availableColors",
        COALESCE(variant_summary.total_stock, 0) AS "totalStock",
        default_variant.id AS "defaultVariantId",
        COALESCE(default_variant.discount_percent, 0) AS "discountPercent",
        default_variant.legacy_price_delta AS "legacyPriceDelta",
        default_variant.legacy_pricing_active AS "legacyPricingActive",
        COALESCE(default_variant.stock_quantity, 0) AS "defaultVariantStock",
        rp.similarity_score AS "similarityScore"
      FROM ranked_products rp
      JOIN products p ON p.id = rp.product_id
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
      LEFT JOIN LATERAL (
        SELECT
          pv.id,
          pv.stock_quantity,
          pv.discount_percent,
          pv.legacy_price_delta,
          pv.legacy_pricing_active
        FROM (
          SELECT
            source_variant.id,
            source_variant.size,
            source_variant.color,
            source_variant.stock_quantity,
            source_variant.discount_percent,
            source_variant.legacy_pricing_active,
            to_jsonb(source_variant) ->> 'legacy_price_delta' AS legacy_price_delta,
            ${VARIANT_DISPLAYED_PRICE} AS displayed_price
          FROM product_variants source_variant
          WHERE source_variant.product_id = p.id
        ) pv
        WHERE ${defaultVariantConditions.join('\n          AND ')}
        ORDER BY pv.id ASC
        LIMIT 1
      ) default_variant ON true
      ORDER BY rp.similarity_score DESC, p.id ASC
      LIMIT ${resultLimit}
    `,
    params
  };
}

function mapProductCard(row) {
  const discountPercent = Number(row.discountPercent);
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    category: row.category,
    gender: row.gender,
    price: calculateVariantPrice(row.basePrice, discountPercent, row.legacyPriceDelta, row.legacyPricingActive),
    discountPercent,
    imageUrl: row.imageUrl,
    availableSizes: row.availableSizes || [],
    availableColors: row.availableColors || [],
    totalStock: Number(row.totalStock || 0),
    defaultVariantId: row.defaultVariantId ? Number(row.defaultVariantId) : null,
    defaultVariantStock: Number(row.defaultVariantStock || 0),
    similarityScore: Number(row.similarityScore)
  };
}

async function searchProductsByImage({ data, mimeType, filters = {}, limit = MAX_SEARCH_RESULTS }) {
  const image = validateImageInput({ buffer: data, mimetype: mimeType, size: data?.length });
  const { model } = getImageEmbeddingConfig();
  const embedding = await embedImage(image);
  const searchQuery = buildSearchQuery(embedding, model, filters, limit);
  const result = await query(searchQuery.text, searchQuery.params);
  return { products: result.rows.map(mapProductCard), threshold: IMAGE_SEARCH_THRESHOLD };
}

async function getImageEmbeddingOverview() {
  const { model, dimension } = getImageEmbeddingConfig();
  const result = await query(
    `
      SELECT
        COUNT(*) AS "totalImages",
        COUNT(*) FILTER (WHERE pie.status = 'active') AS "indexedCount",
        COUNT(*) FILTER (WHERE pie.status = 'error') AS "errorCount",
        COUNT(*) FILTER (WHERE pie.status = 'needs_reindex') AS "needsReindexCount",
        MAX(pie.updated_at) FILTER (WHERE pie.status = 'active') AS "lastIndexedAt"
      FROM product_images pi
      JOIN products p ON p.id = pi.product_id
      LEFT JOIN product_image_embeddings pie
        ON pie.product_image_id = pi.id
        AND pie.product_id = pi.product_id
        AND pie.embedding_model = $1
      WHERE p.status = 'active'
    `,
    [model]
  );
  const row = result.rows[0] || {};

  return {
    totalImages: Number(row.totalImages || 0),
    indexedCount: Number(row.indexedCount || 0),
    errorCount: Number(row.errorCount || 0),
    needsReindexCount: Number(row.needsReindexCount || 0),
    model,
    dimension,
    lastIndexedAt: row.lastIndexedAt || null
  };
}

module.exports = {
  validateImageInput,
  indexProductImage,
  reindexProductImages,
  reindexAllProductImages,
  searchProductsByImage,
  getImageEmbeddingOverview
};
