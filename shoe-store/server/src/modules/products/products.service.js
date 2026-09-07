const { query } = require('../../db/pool');
const { HttpError } = require('../../utils/httpError');
const { calculateVariantPrice } = require('./pricing');

const SORTS = {
  price_asc: 'p.base_price ASC',
  price_desc: 'p.base_price DESC',
  newest: 'p.created_at DESC',
  name_asc: 'p.name ASC'
};

function toNumber(value) {
  return value === null || value === undefined ? value : Number(value);
}

function cleanText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function addParam(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function normalizePriceFilter(filters, field) {
  if (!Object.prototype.hasOwnProperty.call(filters, field)) {
    return null;
  }

  const value = filters[field];
  if (Array.isArray(value) || value === null || value === undefined) {
    throw new HttpError(400, 'Price filter must be a nonnegative number');
  }

  const text = String(value).trim();
  if (!text) {
    throw new HttpError(400, 'Price filter must be a nonnegative number');
  }

  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new HttpError(400, 'Price filter must be a nonnegative number');
  }

  return amount.toFixed(2);
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
    totalStock: Number(row.totalStock || 0),
    defaultVariantId: row.defaultVariantId ? Number(row.defaultVariantId) : null,
    defaultVariantStock: Number(row.defaultVariantStock || 0)
  };
}

function mapProductDetail(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    description: row.description,
    brand: row.brand,
    category: row.category,
    gender: row.gender,
    price: toNumber(row.price),
    images: (row.images || []).map((image) => ({
      id: Number(image.id),
      imageUrl: image.imageUrl,
      altText: image.altText,
      sortOrder: Number(image.sortOrder)
    })),
    variants: (row.variants || []).map((variant) => {
      const discountPercent = toNumber(variant.discountPercent);
      return {
        id: Number(variant.id),
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        stockQuantity: Number(variant.stockQuantity),
        discountPercent,
        unitPrice: calculateVariantPrice(row.price, discountPercent, variant.legacyPriceDelta)
      };
    })
  };
}

function buildProductListQuery(filters) {
  const params = [];
  const where = ["p.status = 'active'"];

  const q = cleanText(filters.q);
  if (q) {
    const placeholder = addParam(params, `%${q.toLowerCase()}%`);
    where.push(`(
      LOWER(p.name) ILIKE ${placeholder}
      OR LOWER(p.description) ILIKE ${placeholder}
      OR LOWER(p.brand) ILIKE ${placeholder}
      OR LOWER(p.category) ILIKE ${placeholder}
    )`);
  }

  ['brand', 'category', 'gender'].forEach((field) => {
    const value = cleanText(filters[field]);
    if (value) {
      where.push(`LOWER(p.${field}) = LOWER(${addParam(params, value)})`);
    }
  });

  const size = cleanText(filters.size);
  const color = cleanText(filters.color);
  if (size || color) {
    const variantConditions = ['filtered_variant.product_id = p.id', 'filtered_variant.stock_quantity > 0'];

    if (size) {
      variantConditions.push(`filtered_variant.size = ${addParam(params, size)}`);
    }

    if (color) {
      variantConditions.push(`LOWER(filtered_variant.color) = LOWER(${addParam(params, color)})`);
    }

    where.push(`EXISTS (
      SELECT 1
      FROM product_variants filtered_variant
      WHERE ${variantConditions.join('\n        AND ')}
    )`);
  }

  const minPrice = normalizePriceFilter(filters, 'minPrice');
  if (minPrice) {
    where.push(`p.base_price >= ${addParam(params, minPrice)}`);
  }

  const maxPrice = normalizePriceFilter(filters, 'maxPrice');
  if (maxPrice) {
    where.push(`p.base_price <= ${addParam(params, maxPrice)}`);
  }

  const sort = SORTS[filters.sort] || SORTS.newest;

  return {
    text: `
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
        COALESCE(default_variant.stock_quantity, 0) AS "defaultVariantStock"
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
      LEFT JOIN LATERAL (
        SELECT
          pv.id,
          pv.stock_quantity,
          pv.discount_percent,
          to_jsonb(pv) ->> 'legacy_price_delta' AS legacy_price_delta
        FROM product_variants pv
        WHERE pv.product_id = p.id
          AND pv.stock_quantity > 0
        ORDER BY pv.id ASC
        LIMIT 1
      ) default_variant ON true
      WHERE ${where.join('\n        AND ')}
      ORDER BY ${sort}, p.id ASC
    `,
    params
  };
}

async function listProducts(filters = {}) {
  const { text, params } = buildProductListQuery(filters);
  const result = await query(text, params);
  return result.rows.map(mapProductCard);
}

async function getProductBySlug(slug) {
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
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'id', pi.id,
              'imageUrl', pi.image_url,
              'altText', pi.alt_text,
              'sortOrder', pi.sort_order
            )
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'
        ) AS images,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'id', pv.id,
              'sku', pv.sku,
              'size', pv.size,
              'color', pv.color,
              'stockQuantity', pv.stock_quantity,
              'discountPercent', pv.discount_percent,
              'legacyPriceDelta', to_jsonb(pv) ->> 'legacy_price_delta'
            )
          ) FILTER (WHERE pv.id IS NOT NULL),
          '[]'
        ) AS variants
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id
      LEFT JOIN product_variants pv ON pv.product_id = p.id
      WHERE p.slug = $1
        AND p.status = 'active'
      GROUP BY p.id
    `,
    [slug]
  );

  const product = mapProductDetail(result.rows[0]);
  if (!product) {
    throw new HttpError(404, 'Product not found');
  }

  product.images.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  product.variants.sort((a, b) => a.id - b.id);
  return product;
}

module.exports = {
  listProducts,
  getProductBySlug
};
