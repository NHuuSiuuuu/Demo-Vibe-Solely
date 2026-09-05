const { query } = require('../../db/pool');
const { HttpError } = require('../../utils/httpError');

const COMMON_BRANDS = ['nike', 'adidas', 'puma', 'converse', 'vans', 'new balance', 'asics', 'reebok'];

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function cleanMessage(message) {
  return String(message || '').trim();
}

function toNumber(value) {
  return value === null || value === undefined ? value : Number(value);
}

function addParam(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function mapProductCard(row) {
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
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

function extractBudget(message) {
  const normalized = normalizeText(message).replace(/,/g, '.');
  const budgetMatch = normalized.match(/(?:duoi|toi da|tam|khoang|<=?)\s*(\d+(?:\.\d+)?)\s*(trieu|tr|m|nghin|ngan|k)?/);
  const plainMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(trieu|tr|m|nghin|ngan|k)/);
  const match = budgetMatch || plainMatch;

  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2] || '';
  if (!Number.isFinite(amount)) {
    return null;
  }

  if (['trieu', 'tr', 'm'].includes(unit)) {
    return Math.round(amount * 1000000);
  }

  if (['nghin', 'ngan', 'k'].includes(unit)) {
    return Math.round(amount * 1000);
  }

  return Math.round(amount);
}

function extractSize(message) {
  const normalized = normalizeText(message);
  const match = normalized.match(/\bsize\s*(\d{2}(?:\.\d)?)\b/);
  return match ? match[1] : null;
}

function extractGender(message) {
  const normalized = normalizeText(message);
  if (/\b(nam|men|male)\b/.test(normalized)) {
    return 'men';
  }

  if (/\b(nu|women|female)\b/.test(normalized)) {
    return 'women';
  }

  return null;
}

function extractBrand(message) {
  const normalized = normalizeText(message);
  return COMMON_BRANDS.find((brand) => normalized.includes(brand)) || null;
}

function extractKeywords(message) {
  const normalized = normalizeText(message);
  const keywords = [];

  if (/\b(chay bo|running|runner)\b/.test(normalized)) {
    keywords.push('running');
  }

  if (/\b(bong ro|basketball)\b/.test(normalized)) {
    keywords.push('basketball');
  }

  if (/\b(lifestyle|di choi|hang ngay|casual)\b/.test(normalized)) {
    keywords.push('lifestyle');
  }

  if (/\b(tennis|court)\b/.test(normalized)) {
    keywords.push('tennis');
  }

  return keywords;
}

function buildAdvisorQuery(filters) {
  const params = [];
  const where = ["p.status = 'active'"];

  if (filters.gender) {
    where.push(`LOWER(p.gender) IN (LOWER(${addParam(params, filters.gender)}), 'unisex')`);
  }

  if (filters.brand) {
    where.push(`LOWER(p.brand) = LOWER(${addParam(params, filters.brand)})`);
  }

  if (filters.maxPrice) {
    where.push(`p.base_price <= ${addParam(params, String(filters.maxPrice))}`);
  }

  if (filters.size) {
    where.push(`EXISTS (
      SELECT 1
      FROM product_variants filtered_variant
      WHERE filtered_variant.product_id = p.id
        AND filtered_variant.stock_quantity > 0
        AND filtered_variant.size = ${addParam(params, filters.size)}
    )`);
  }

  if (filters.keywords.length > 0) {
    const keywordConditions = filters.keywords.map((keyword) => {
      const placeholder = addParam(params, `%${keyword}%`);
      return `(LOWER(p.name) ILIKE ${placeholder}
        OR LOWER(p.description) ILIKE ${placeholder}
        OR LOWER(p.category) ILIKE ${placeholder})`;
    });
    where.push(`(${keywordConditions.join('\n        OR ')})`);
  }

  return {
    text: `
      SELECT
        p.id,
        p.name,
        p.slug,
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
      WHERE ${where.join('\n        AND ')}
      ORDER BY p.base_price ASC, p.id ASC
      LIMIT 4
    `,
    params
  };
}

async function findMatchingProducts(filters) {
  const { text, params } = buildAdvisorQuery(filters);
  const result = await query(text, params);
  return result.rows.map(mapProductCard);
}

function buildAnswer(products) {
  if (products.length === 0) {
    return 'Hiện không có sản phẩm phù hợp chính xác. Bạn có thể mở rộng bộ lọc về ngân sách, size, thương hiệu hoặc mục đích sử dụng để xem thêm lựa chọn.';
  }

  const names = products.map((product) => product.name).join(', ');
  return `Gợi ý phù hợp cho bạn: ${names}. Các mẫu này còn hàng, đúng tiêu chí chính và có mức giá dễ so sánh.`;
}

async function storeMessage({ userId, sessionId = null, role, content }) {
  await query(
    `
      INSERT INTO ai_chat_messages (user_id, session_id, role, content)
      VALUES ($1, $2, $3, $4)
    `,
    [userId, sessionId, role, content]
  );
}

async function adviseProducts({ user, message }) {
  const cleanedMessage = cleanMessage(message);
  if (!cleanedMessage) {
    throw new HttpError(400, 'Message is required');
  }

  const filters = {
    maxPrice: extractBudget(cleanedMessage),
    size: extractSize(cleanedMessage),
    gender: extractGender(cleanedMessage),
    brand: extractBrand(cleanedMessage),
    keywords: extractKeywords(cleanedMessage)
  };

  const products = await findMatchingProducts(filters);
  const answer = buildAnswer(products);

  await storeMessage({ userId: user.id, role: 'user', content: cleanedMessage });
  await storeMessage({ userId: user.id, role: 'assistant', content: answer });

  return { answer, products };
}

module.exports = {
  adviseProducts,
  extractBudget,
  extractSize,
  extractGender,
  extractBrand,
  extractKeywords
};
