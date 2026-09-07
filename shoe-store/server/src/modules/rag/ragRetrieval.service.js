const { query } = require('../../db/pool');
const { calculateVariantPrice } = require('../products/pricing');
const { embedText } = require('./gemini.client');

function vectorLiteral(values) {
  return `[${values.map((value) => Number(value) || 0).join(',')}]`;
}

function toNumber(value) {
  return value === null || value === undefined ? value : Number(value);
}

function normalizeMetadata(metadata) {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata);
    } catch (_error) {
      return {};
    }
  }
  return metadata;
}

function mapChunk(row) {
  return {
    id: Number(row.id),
    sourceType: row.source_type,
    sourceId: Number(row.source_id),
    title: row.title,
    content: row.content,
    metadata: normalizeMetadata(row.metadata),
    score: Number(row.score || 0)
  };
}

function mapProductCard(row) {
  const discountPercent = toNumber(row.discountPercent);
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    category: row.category,
    gender: row.gender,
    price: calculateVariantPrice(row.basePrice, discountPercent, row.legacyPriceDelta),
    discountPercent,
    imageUrl: row.imageUrl,
    availableSizes: row.availableSizes || [],
    availableColors: row.availableColors || [],
    totalStock: Number(row.totalStock || 0)
  };
}

async function loadProductsByIds(productIds) {
  if (productIds.length === 0) return [];

  const result = await query(
    `
      SELECT
        p.id,
        p.name,
        p.slug,
        p.brand,
        p.category,
        p.gender,
        p.base_price AS "basePrice",
        COALESCE(default_variant.discount_percent, 0) AS "discountPercent",
        default_variant.legacy_price_delta AS "legacyPriceDelta",
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
          pv.discount_percent,
          to_jsonb(pv) ->> 'legacy_price_delta' AS legacy_price_delta
        FROM product_variants pv
        WHERE pv.product_id = p.id
          AND pv.stock_quantity > 0
        ORDER BY pv.id ASC
        LIMIT 1
      ) default_variant ON true
      LEFT JOIN LATERAL (
        SELECT
          ARRAY_AGG(DISTINCT pv.size ORDER BY pv.size) FILTER (WHERE pv.stock_quantity > 0) AS available_sizes,
          ARRAY_AGG(DISTINCT pv.color ORDER BY pv.color) FILTER (WHERE pv.stock_quantity > 0) AS available_colors,
          SUM(pv.stock_quantity) FILTER (WHERE pv.stock_quantity > 0) AS total_stock
        FROM product_variants pv
        WHERE pv.product_id = p.id
      ) variant_summary ON true
      WHERE p.status = 'active'
        AND p.id = ANY($1::bigint[])
      GROUP BY p.id, primary_image.image_url, default_variant.discount_percent, default_variant.legacy_price_delta, variant_summary.available_sizes, variant_summary.available_colors, variant_summary.total_stock
    `,
    [productIds]
  );

  const byId = new Map(result.rows.map((row) => [Number(row.id), mapProductCard(row)]));
  return productIds.map((id) => byId.get(Number(id))).filter(Boolean);
}

function matchesFilter(product, filters = {}) {
  if (filters.maxPrice && product.price > Number(filters.maxPrice)) return false;
  if (filters.minPrice && product.price < Number(filters.minPrice)) return false;
  if (filters.size && !product.availableSizes.map(String).includes(String(filters.size))) return false;
  if (filters.gender && ![String(filters.gender).toLowerCase(), 'unisex'].includes(String(product.gender).toLowerCase())) return false;
  if (filters.category && String(product.category).toLowerCase() !== String(filters.category).toLowerCase()) return false;
  if (Array.isArray(filters.keywords) && filters.keywords.length > 0) {
    const searchable = `${product.name} ${product.category} ${product.brand}`.toLowerCase();
    return filters.keywords.some((keyword) => searchable.includes(String(keyword).toLowerCase()));
  }
  return true;
}

function buildSources(chunks) {
  const seen = new Set();
  return chunks
    .map((chunk) => {
      const type = chunk.sourceType;
      const source = {
        type,
        id: chunk.sourceId,
        title: chunk.title,
        score: chunk.score
      };
      if (type === 'document') {
        source.slug = chunk.metadata.slug;
        source.documentType = chunk.metadata.documentType;
      }
      if (type === 'product') {
        source.productId = chunk.metadata.productId || chunk.sourceId;
        source.slug = chunk.metadata.slug;
      }
      return source;
    })
    .filter((source) => {
      const key = `${source.type}:${source.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function retrieveContext({ message, filters = {}, limit = 6 }) {
  const embedding = await embedText(message);
  const result = await query(
    `
      SELECT id, source_type, source_id, title, content, metadata, 1 - (embedding <=> $1::vector) AS score
      FROM rag_chunks
      WHERE status = 'active'
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `,
    [vectorLiteral(embedding), limit]
  );
  const chunks = result.rows.map(mapChunk);
  const productIds = [
    ...new Set(chunks.filter((chunk) => chunk.sourceType === 'product').map((chunk) => chunk.metadata.productId || chunk.sourceId))
  ];
  const products = (await loadProductsByIds(productIds)).filter((product) => matchesFilter(product, filters));
  const allowedProductIds = new Set(products.map((product) => product.id));
  const filteredChunks = chunks.filter(
    (chunk) => chunk.sourceType !== 'product' || allowedProductIds.has(Number(chunk.metadata.productId || chunk.sourceId))
  );

  return {
    chunks: filteredChunks,
    sources: buildSources(filteredChunks),
    products
  };
}

module.exports = {
  retrieveContext
};
