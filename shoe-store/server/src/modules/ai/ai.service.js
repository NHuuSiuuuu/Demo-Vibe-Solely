const { query } = require('../../db/pool');
const { HttpError } = require('../../utils/httpError');

const COMMON_BRANDS = ['nike', 'adidas', 'puma', 'converse', 'vans', 'new balance', 'asics', 'reebok'];
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const PRODUCT_INTENTS = [
  {
    pattern: /\b(chay bo|running|runner)\b/,
    keywords: ['running']
  },
  {
    pattern: /\b(leo nui|trekking|hiking|di rung|duong mon|trail|outdoor|dia hinh)\b/,
    keywords: ['trail', 'trekking', 'outdoor']
  },
  {
    pattern: /\b(bong ro|basketball)\b/,
    keywords: ['basketball']
  },
  {
    pattern: /\b(lifestyle|di choi|hang ngay|casual)\b/,
    keywords: ['lifestyle']
  },
  {
    pattern: /\b(tennis|court)\b/,
    keywords: ['tennis']
  }
];

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

  PRODUCT_INTENTS.forEach((intent) => {
    if (intent.pattern.test(normalized)) {
      intent.keywords.forEach((keyword) => {
        if (!keywords.includes(keyword)) {
          keywords.push(keyword);
        }
      });
    }
  });

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

function buildFallbackAnswer(products) {
  if (products.length === 0) {
    return 'Hiện không có sản phẩm phù hợp chính xác. Bạn có thể mở rộng bộ lọc về ngân sách, size, thương hiệu hoặc mục đích sử dụng để xem thêm lựa chọn.';
  }

  if (products.length === 1) {
    const [product] = products;
    return `Mình gợi ý ${product.name} vì đây là mẫu phù hợp nhất với tiêu chí hiện tại trong catalog. Mẫu này còn hàng, thuộc nhóm ${product.category} và có giá ${product.price.toLocaleString('vi-VN')} ₫.`;
  }

  const names = products.map((product) => product.name).join(', ');
  return `Gợi ý phù hợp cho bạn: ${names}. Các mẫu này còn hàng, đúng tiêu chí chính và có mức giá dễ so sánh.`;
}

function formatProductForRanking(product) {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    gender: product.gender,
    price: product.price,
    availableSizes: product.availableSizes,
    availableColors: product.availableColors,
    totalStock: product.totalStock
  };
}

function extractOpenAiText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const content = Array.isArray(payload?.output)
    ? payload.output.flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    : [];
  const text = content
    .map((item) => {
      if (typeof item.text === 'string') {
        return item.text;
      }
      if (typeof item.output_text === 'string') {
        return item.output_text;
      }
      return '';
    })
    .join('\n')
    .trim();

  return text || null;
}

async function rankProductsWithOpenAi({ message, filters, products }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || products.length === 0 || typeof fetch !== 'function') {
    return null;
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      max_output_tokens: 220,
      instructions:
        'Bạn là trợ lý bán giày của Solely. Chỉ tư vấn dựa trên danh sách sản phẩm đã được backend lọc. Không bịa sản phẩm, giá, tồn kho hoặc khuyến mãi. Trả lời tiếng Việt, ngắn gọn, ưu tiên sản phẩm phù hợp nhất trước.',
      input: JSON.stringify({
        customerQuestion: message,
        filters,
        products: products.map(formatProductForRanking)
      })
    })
  });

  if (!response.ok) {
    return null;
  }

  return extractOpenAiText(await response.json());
}

async function buildAnswer({ message, filters, products }) {
  try {
    const rankedAnswer = await rankProductsWithOpenAi({ message, filters, products });
    if (rankedAnswer) {
      return rankedAnswer;
    }
  } catch (_error) {
    return buildFallbackAnswer(products);
  }

  return buildFallbackAnswer(products);
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
  const answer = await buildAnswer({ message: cleanedMessage, filters, products });

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
