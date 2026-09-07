const assert = require('node:assert/strict');
const test = require('node:test');

const originalApiKey = process.env.GEMINI_API_KEY;
const originalImageModel = process.env.GEMINI_IMAGE_EMBEDDING_MODEL;
const originalDimension = process.env.GEMINI_EMBEDDING_DIMENSION;
const originalFetch = global.fetch;

function loadClient() {
  const clientPath = require.resolve('../src/modules/rag/gemini.client');
  delete require.cache[clientPath];
  return require('../src/modules/rag/gemini.client');
}

function restoreEnvironment() {
  if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalApiKey;

  if (originalImageModel === undefined) delete process.env.GEMINI_IMAGE_EMBEDDING_MODEL;
  else process.env.GEMINI_IMAGE_EMBEDDING_MODEL = originalImageModel;

  if (originalDimension === undefined) delete process.env.GEMINI_EMBEDDING_DIMENSION;
  else process.env.GEMINI_EMBEDDING_DIMENSION = originalDimension;

  global.fetch = originalFetch;
}

test.afterEach(restoreEnvironment);

test('Gemini image embedding posts inline base64 data and returns the vector', async () => {
  const apiKey = 'test-image-api-key';
  process.env.GEMINI_API_KEY = apiKey;
  delete process.env.GEMINI_IMAGE_EMBEDDING_MODEL;
  delete process.env.GEMINI_EMBEDDING_DIMENSION;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return { embedding: { values: Array.from({ length: 768 }, (_, index) => index / 768) } };
      }
    };
  };

  const { embedImage, getImageEmbeddingConfig } = loadClient();
  const vector = await embedImage({ data: Buffer.from('fake-png'), mimeType: 'image/png' });

  assert.equal(vector.length, 768);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /models\/gemini-embedding-2:embedContent/);
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body, {
    model: 'models/gemini-embedding-2',
    content: { parts: [{ inlineData: { mimeType: 'image/png', data: Buffer.from('fake-png').toString('base64') } }] },
    outputDimensionality: 768
  });
  assert.doesNotMatch(calls[0].options.body, new RegExp(apiKey));
  assert.deepEqual(getImageEmbeddingConfig(), { model: 'gemini-embedding-2', dimension: 768 });
});

test('Gemini image embedding accepts JPEG and uses configured model and dimension', async () => {
  process.env.GEMINI_API_KEY = 'test-image-api-key';
  process.env.GEMINI_IMAGE_EMBEDDING_MODEL = 'custom-image-model';
  process.env.GEMINI_EMBEDDING_DIMENSION = '768';
  global.fetch = async () => ({
    ok: true,
    async json() {
      return { embedding: { values: Array.from({ length: 768 }, () => 0.25) } };
    }
  });

  const { embedImage, getImageEmbeddingConfig } = loadClient();
  const vector = await embedImage({ data: Buffer.from('fake-jpeg'), mimeType: 'image/jpeg' });

  assert.equal(vector.length, 768);
  assert.deepEqual(getImageEmbeddingConfig(), { model: 'custom-image-model', dimension: 768 });
});

test('Gemini image embedding rejects unsupported MIME types', async () => {
  process.env.GEMINI_API_KEY = 'test-image-api-key';
  const { embedImage } = loadClient();

  await assert.rejects(
    () => embedImage({ data: Buffer.from('fake-gif'), mimeType: 'image/gif' }),
    /Unsupported image MIME type/
  );
});

test('Gemini image embedding rejects a missing API key without exposing secrets', async () => {
  delete process.env.GEMINI_API_KEY;
  const { embedImage } = loadClient();

  await assert.rejects(
    () => embedImage({ data: Buffer.from('fake-png'), mimeType: 'image/png' }),
    (error) => {
      assert.match(error.message, /GEMINI_API_KEY/);
      assert.doesNotMatch(error.message, /undefined|null/);
      return true;
    }
  );
});

test('Gemini image embedding rejects vectors with the wrong dimension', async () => {
  const apiKey = 'test-image-api-key';
  process.env.GEMINI_API_KEY = apiKey;
  global.fetch = async () => ({
    ok: true,
    async json() {
      return { embedding: { values: [0.1, 0.2] } };
    }
  });

  const { embedImage } = loadClient();

  await assert.rejects(
    () => embedImage({ data: Buffer.from('fake-png'), mimeType: 'image/png' }),
    (error) => {
      assert.match(error.message, /dimension/i);
      assert.doesNotMatch(error.message, new RegExp(apiKey));
      return true;
    }
  );
});

test('Gemini image embedding hides provider error details and API key', async () => {
  const apiKey = 'test-image-api-key';
  process.env.GEMINI_API_KEY = apiKey;
  global.fetch = async () => ({
    ok: false,
    status: 400,
    async json() {
      return { error: { message: `provider rejected ${apiKey}` } };
    }
  });

  const { embedImage } = loadClient();

  await assert.rejects(
    () => embedImage({ data: Buffer.from('fake-png'), mimeType: 'image/png' }),
    (error) => {
      assert.match(error.message, /Gemini image embedding failed with 400/);
      assert.doesNotMatch(error.message, new RegExp(apiKey));
      return true;
    }
  );
});
