const {
  extractBudget,
  extractSize,
  extractGender,
  extractKeywords
} = require('../ai/ai.service');
const { generateGroundedAnswer } = require('./gemini.client');
const { retrieveContext } = require('./ragRetrieval.service');
const { HttpError } = require('../../utils/httpError');

const GREETING_ANSWER = 'Em đây, anh muốn tìm giày theo mục đích, size, ngân sách hay hỏi chính sách mua hàng nào?';

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

function isGreeting(message) {
  return /^(alo|hello|hi|xin chao|chao|hey|em oi|shop oi)[!.?]*$/.test(normalizeText(message));
}

function extractCategory(message) {
  const normalized = normalizeText(message);
  const categoryMap = [
    { category: 'running', pattern: /\b(chay bo|running|runner)\b/ },
    { category: 'trail', pattern: /\b(leo nui|trekking|hiking|di rung|duong mon|trail|outdoor|dia hinh)\b/ },
    { category: 'basketball', pattern: /\b(bong ro|basketball)\b/ },
    { category: 'tennis', pattern: /\b(tennis|court|pickleball)\b/ },
    { category: 'training', pattern: /\b(gym|training|tap luyen|fitness)\b/ },
    { category: 'walking', pattern: /\b(di bo|walking|du lich|dung lau)\b/ },
    { category: 'sneakers', pattern: /\b(sneaker|di choi|hang ngay|casual|di hoc)\b/ },
    { category: 'boots', pattern: /\b(boot|boots)\b/ }
  ];
  return categoryMap.find((entry) => entry.pattern.test(normalized))?.category || null;
}

function extractRequestedCount(message) {
  const normalized = normalizeText(message);
  const explicit = normalized.match(/\b(?:top|goi y|lay|chon)\s*(\d)\b/);
  if (explicit) return Math.min(Math.max(Number(explicit[1]), 1), 6);
  if (/\b(mot|1)\s+(doi|mau|san pham)\b/.test(normalized)) return 1;
  return 4;
}

function buildFilters(message) {
  return {
    maxPrice: extractBudget(message),
    size: extractSize(message),
    gender: extractGender(message),
    category: extractCategory(message),
    keywords: extractKeywords(message)
  };
}

function buildContext(chunks) {
  return chunks.map((chunk) => `[${chunk.sourceType}:${chunk.sourceId}] ${chunk.title}\n${chunk.content}`).join('\n\n');
}

function buildFallbackAnswer(hasContext) {
  if (!hasContext) {
    return 'Solely chưa có đủ thông tin trong kho tri thức để trả lời chắc chắn. Anh có thể hỏi cụ thể hơn về sản phẩm, size, ngân sách hoặc chính sách mua hàng.';
  }

  return 'Solely đã tìm thấy một số thông tin liên quan, nhưng hiện chưa tạo được câu trả lời từ Gemini. Anh có thể thử hỏi ngắn gọn hơn hoặc kiểm tra lại cấu hình Gemini.';
}

async function answerWithRag({ user, message, includeChunks = false }) {
  const cleanedMessage = cleanMessage(message);
  if (!cleanedMessage) {
    throw new HttpError(400, 'Message is required');
  }

  if (isGreeting(cleanedMessage)) {
    return {
      answer: GREETING_ANSWER,
      products: [],
      sources: [],
      ...(includeChunks ? { chunks: [] } : {})
    };
  }

  const requestedCount = extractRequestedCount(cleanedMessage);
  const filters = buildFilters(cleanedMessage);
  const context = await retrieveContext({ message: cleanedMessage, filters, limit: Math.max(6, requestedCount) });
  const products = context.products.slice(0, requestedCount);
  const contextText = buildContext(context.chunks);
  const generatedAnswer = context.chunks.length
    ? await generateGroundedAnswer({ message: cleanedMessage, context: contextText, products })
    : null;

  return {
    answer: generatedAnswer || buildFallbackAnswer(context.chunks.length > 0),
    products,
    sources: context.sources,
    ...(includeChunks ? { chunks: context.chunks } : {})
  };
}

module.exports = {
  answerWithRag
};
