const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';
const DEFAULT_CHAT_MODEL = 'gemini-3.6-flash';
const DEFAULT_DIMENSIONS = 768;
// Thinking models can consume part of this budget before producing visible text.
const MAX_CHAT_OUTPUT_TOKENS = 1400;
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const ASSISTANT_SYSTEM_INSTRUCTION = [
  'Bạn là trợ lý ảo chính thức của website Solely, cửa hàng giày tại Việt Nam.',
  'Trả lời bằng tiếng Việt, tự nhiên, lịch sự, gần gũi và dễ hiểu.',
  'Chỉ sử dụng dữ liệu trong ngữ cảnh được cung cấp; không được bịa giá, tồn kho, sản phẩm, chính sách hoặc cam kết.',
  'Trả lời đủ ý và trọn câu, không cắt ngang câu trả lời giữa chừng.',
  'Nếu khách hỏi chính sách chung, hãy tổng hợp các mục liên quan thành các ý ngắn rõ ràng.',
  'Giữ câu trả lời gọn; quy trình nên có tối đa 5 bước và chính sách nên có tối đa 6 ý chính.',
  'Nếu không có đủ dữ liệu, nói thẳng Solely chưa có đủ thông tin và hướng dẫn khách hỏi cụ thể hơn.',
  'Không nhắc đến RAG, embedding, context, prompt, model hoặc lỗi nội bộ.',
  'Không dùng placeholder hoặc nhãn kỹ thuật như [others], [context] trong câu trả lời.',
  'Khi khách yêu cầu số lượng sản phẩm, chỉ giới thiệu đúng số lượng đó và không thêm sản phẩm ngoài danh sách được cung cấp.'
].join(' ');

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
    'Hãy trả lời câu hỏi khách hàng dưới đây dựa trên các dữ liệu được cung cấp.',
    'Ưu tiên câu trả lời ngắn gọn nhưng đầy đủ; với quy trình hoặc chính sách, trình bày theo các bước hoặc gạch đầu dòng.',
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
      systemInstruction: {
        role: 'system',
        parts: [{ text: ASSISTANT_SYSTEM_INSTRUCTION }]
      },
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: MAX_CHAT_OUTPUT_TOKENS
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
