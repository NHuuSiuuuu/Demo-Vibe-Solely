const assert = require('node:assert/strict');
const test = require('node:test');

const originalFetch = global.fetch;
const originalGeminiApiKey = process.env.GEMINI_API_KEY;

test.after(() => {
  global.fetch = originalFetch;
  if (originalGeminiApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalGeminiApiKey;
  }
});

test.beforeEach(() => {
  global.fetch = async () => {
    throw new Error('fetch should not be called');
  };
});

test('Gemini client reports missing key without calling fetch', async () => {
  delete process.env.GEMINI_API_KEY;
  const { isGeminiConfigured, embedText } = require('../src/modules/rag/gemini.client');

  assert.equal(isGeminiConfigured(), false);
  await assert.rejects(() => embedText('hello'), /GEMINI_API_KEY/);
});

test('RAG text helper chunks long Vietnamese policy text', () => {
  const { chunkText } = require('../src/modules/rag/ragText.service');
  const chunks = chunkText({ title: 'Đổi trả', content: 'Nội dung '.repeat(260), maxLength: 500 });

  assert.equal(chunks.length > 1, true);
  assert.equal(chunks[0].chunkIndex, 0);
  assert.match(chunks[0].title, /Đổi trả/);
});
