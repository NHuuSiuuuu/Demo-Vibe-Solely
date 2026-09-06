const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';
const DEFAULT_CHAT_MODEL = 'gemini-2.5-flash';
const DEFAULT_DIMENSIONS = 768;
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function getApiKey() {
  return process.env.GEMINI_API_KEY || '';
}

function isGeminiConfigured() {
  return Boolean(getApiKey());
}

function extractGeneratedText(payload) {
  const parts = Array.isArray(payload?.candidates?.[0]?.content?.parts) ? payload.candidates[0].content.parts : [];
  const text = parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('\n')
    .trim();

  return text || null;
}

function buildGroundedPrompt({ message, context, products }) {
  return [
    'Bạn là trợ lý mua sắm của Solely, một cửa hàng giày tại Việt Nam.',
    'Chỉ trả lời dựa trên ngữ cảnh RAG và danh sách sản phẩm được cung cấp.',
    'Không bịa sản phẩm, giá, tồn kho, chính sách, khuyến mãi hoặc cam kết ngoài dữ liệu.',
    'Nếu thiếu dữ liệu để trả lời chắc chắn, hãy nói rõ là Solely chưa có đủ thông tin trong kho tri thức.',
    'Trả lời bằng tiếng Việt, ngắn gọn, hữu ích và ưu tiên thông tin có căn cứ.',
    '',
    `Câu hỏi khách hàng: ${message}`,
    '',
    `Ngữ cảnh RAG:\n${context || 'Không có ngữ cảnh phù hợp.'}`,
    '',
    `Sản phẩm liên quan:\n${JSON.stringify(products || [], null, 2)}`
  ].join('\n');
}

async function embedText(text) {
  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_API_KEY is required for RAG embeddings');
  }

  const model = process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const outputDimensionality = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS || DEFAULT_DIMENSIONS);
  const response = await fetch(`${GEMINI_API_BASE_URL}/${model}:embedContent?key=${getApiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text }] },
      outputDimensionality
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini embedding failed with ${response.status}`);
  }

  const payload = await response.json();
  return payload.embedding?.values || [];
}

async function generateGroundedAnswer({ message, context, products }) {
  if (!isGeminiConfigured() || typeof fetch !== 'function') {
    return null;
  }

  const model = process.env.GEMINI_CHAT_MODEL || DEFAULT_CHAT_MODEL;
  const response = await fetch(`${GEMINI_API_BASE_URL}/${model}:generateContent?key=${getApiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: buildGroundedPrompt({ message, context, products }) }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 320
      }
    })
  });

  if (!response.ok) {
    return null;
  }

  return extractGeneratedText(await response.json());
}

module.exports = {
  isGeminiConfigured,
  embedText,
  generateGroundedAnswer
};
