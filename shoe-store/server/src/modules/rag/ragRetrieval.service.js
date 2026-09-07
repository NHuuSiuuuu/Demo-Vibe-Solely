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

function hasFilterValue(filters, field) {
  return filters[field] !== null && filters[field] !== undefined && String(filters[field]).trim() !== '';
}

function matchesVariantFilter(variant, filters = {}) {
  if (hasFilterValue(filters, 'maxPrice') && variant.unitPrice > Number(filters.maxPrice)) return false;
  if (hasFilterValue(filters, 'minPrice') && variant.unitPrice < Number(filters.minPrice)) return false;
  if (hasFilterValue(filters, 'size') && String(variant.size) !== String(filters.size)) return false;
  return true;
}

function mapProductCard(row, filters = {}) {
  const basePrice = toNumber(row.basePrice);
  const selectedVariant = (row.variants || [])
    .map((variant) => {
      const discountPercent = toNumber(variant.discountPercent);
      return {
        ...variant,
        discountPercent,
        unitPrice: calculateVariantPrice(basePrice, discountPercent, variant.legacyPriceDelta, variant.legacyPricingActive)
      };
    })
    .find((variant) => matchesVariantFilter(variant, filters));

  if (!selectedVariant) return null;

  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    category: row.category,
    gender: row.gender,
    price: selectedVariant.unitPrice,
    discountPercent: selectedVariant.discountPercent,
    imageUrl: row.imageUrl,
    availableSizes: row.availableSizes || [],
    availableColors: row.availableColors || [],
    totalStock: Number(row.totalStock || 0)
  };
}

async function loadProductsByIds(productIds, filters) {
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
        primary_image.image_url AS "imageUrl",
        COALESCE(variant_summary.available_sizes, ARRAY[]::TEXT[]) AS "availableSizes",
        COALESCE(variant_summary.available_colors, ARRAY[]::TEXT[]) AS "availableColors",
        COALESCE(variant_summary.total_stock, 0) AS "totalStock",
        COALESCE(variant_summary.variants, '[]'::JSONB) AS variants
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
          SUM(pv.stock_quantity) FILTER (WHERE pv.stock_quantity > 0) AS total_stock,
          JSONB_AGG(
            JSONB_BUILD_OBJECT(
              'id', pv.id,
              'size', pv.size,
              'discountPercent', pv.discount_percent,
              'legacyPriceDelta', to_jsonb(pv) ->> 'legacy_price_delta',
              'legacyPricingActive', pv.legacy_pricing_active
            ) ORDER BY pv.id
          ) FILTER (WHERE pv.stock_quantity > 0) AS variants
        FROM product_variants pv
        WHERE pv.product_id = p.id
      ) variant_summary ON true
      WHERE p.status = 'active'
        AND p.id = ANY($1::bigint[])
    `,
    [productIds]
  );

  const byId = new Map(result.rows.map((row) => [Number(row.id), mapProductCard(row, filters)]));
  return productIds.map((id) => byId.get(Number(id))).filter(Boolean);
}

function matchesFilter(product, filters = {}) {
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
  const products = (await loadProductsByIds(productIds, filters)).filter((product) => matchesFilter(product, filters));
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
