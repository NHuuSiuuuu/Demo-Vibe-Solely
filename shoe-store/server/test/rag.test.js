const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

const originalLoad = Module._load;
const originalFetch = global.fetch;
const originalGeminiApiKey = process.env.GEMINI_API_KEY;

const productRows = [
  {
    id: '12',
    name: 'Solely Trail Guard',
    slug: 'trail-guard-pro',
    description:
      'Mục đích: trekking cuối tuần, đi rừng nhẹ và đường mòn khô. Độ bám cao, mũi giày gia cố.',
    brand: 'Solely',
    category: 'trail',
    gender: 'men',
    price: '2490000.00',
    imageUrl: '/images/solely-trail-guard.jpg',
    availableSizes: ['42', '43'],
    availableColors: ['olive', 'gray'],
    totalStock: '12'
  },
  {
    id: '13',
    name: 'Solely Cloud Walker',
    slug: 'cloud-step-walker',
    description: 'Mục đích: đi bộ nhiều, du lịch, đứng lâu và sinh hoạt hằng ngày.',
    brand: 'Solely',
    category: 'walking',
    gender: 'women',
    price: '1790000.00',
    imageUrl: '/images/solely-cloud-walker.jpg',
    availableSizes: ['37', '38'],
    availableColors: ['gray', 'navy'],
    totalStock: '29'
  }
];

const documentRows = [
  {
    id: '4',
    title: 'Đổi trả',
    slug: 'doi-tra',
    document_type: 'returns',
    content:
      'Khách có thể yêu cầu đổi trả khi sản phẩm còn nguyên tình trạng, chưa sử dụng ngoài phạm vi thử size trong nhà và còn đầy đủ hộp, tem, phụ kiện đi kèm.',
    status: 'active'
  }
];

const defaultRetrievalRows = [
  {
    id: '101',
    source_type: 'document',
    source_id: '4',
    title: 'Đổi trả',
    content:
      'Khách có thể yêu cầu đổi trả khi sản phẩm còn nguyên tình trạng, chưa sử dụng ngoài phạm vi thử size trong nhà và còn đầy đủ hộp, tem, phụ kiện đi kèm.',
    metadata: { documentType: 'returns', slug: 'doi-tra' },
    score: '0.91'
  }
];

let insertedChunks;
let staleDeletes;
let documentIndexedAt;
let retrievalRows;

function resetStore() {
  insertedChunks = [];
  staleDeletes = [];
  documentIndexedAt = [];
  retrievalRows = defaultRetrievalRows;
}

async function mockQuery(text, params = []) {
  if (text.includes('FROM products p') && text.includes('WHERE p.id = $1')) {
    const row = productRows.find((product) => String(product.id) === String(params[0]));
    return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
  }

  if (text.includes('FROM rag_documents') && text.includes('WHERE id = $1')) {
    const row = documentRows.find((document) => String(document.id) === String(params[0]));
    return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
  }

  if (text.includes('FROM rag_documents') && text.includes("status = 'active'")) {
    return { rows: documentRows, rowCount: documentRows.length };
  }

  if (text.includes('SELECT id') && text.includes('FROM products') && text.includes("status = 'active'")) {
    return { rows: productRows.map((product) => ({ id: product.id })), rowCount: productRows.length };
  }

  if (text.includes('FROM products p') && text.includes("p.status = 'active'")) {
    return { rows: productRows, rowCount: productRows.length };
  }

  if (text.includes('DELETE FROM rag_chunks')) {
    staleDeletes.push({ text, params });
    return { rows: [], rowCount: 1 };
  }

  if (text.includes('INSERT INTO rag_chunks')) {
    insertedChunks.push({ text, params });
    return { rows: [], rowCount: 1 };
  }

  if (text.includes('UPDATE products') || text.includes('UPDATE rag_documents') || text.includes('UPDATE rag_chunks')) {
    documentIndexedAt.push({ text, params });
    return { rows: [], rowCount: text.includes('UPDATE rag_chunks') ? 0 : 1 };
  }

  if (text.includes('FROM rag_chunks') && text.includes('embedding <=>')) {
    return { rows: retrievalRows, rowCount: retrievalRows.length };
  }

  throw new Error(`Unexpected SQL in rag test: ${text}`);
}

Module._load = function patchedLoad(requestPath, parent, isMain) {
  if (requestPath === '../../db/pool' || requestPath === '../db/pool' || requestPath.endsWith('/db/pool')) {
    return { query: mockQuery, pool: { connect: async () => ({ query: mockQuery, release() {} }) } };
  }

  return originalLoad.call(this, requestPath, parent, isMain);
};

test.after(() => {
  Module._load = originalLoad;
  global.fetch = originalFetch;
  if (originalGeminiApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalGeminiApiKey;
  }
});

test.beforeEach(() => {
  resetStore();
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

test('reindexProduct stores product chunks with embeddings', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: true,
    async json() {
      return { embedding: { values: Array.from({ length: 768 }, () => 0.1) } };
    }
  });

  const { reindexProduct } = require('../src/modules/rag/ragIndex.service');
  const result = await reindexProduct(12);

  assert.equal(result.status, 'indexed');
  assert.equal(result.chunksIndexed >= 1, true);
  assert.equal(staleDeletes.some((deleteQuery) => deleteQuery.params[0] === 'product' && deleteQuery.params[1] === 12), true);
  assert.equal(insertedChunks.length >= 1, true);
});

test('reindexProduct leaves a product reindex marker when Gemini embedding fails after stale chunks are deleted', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: false,
    status: 503,
    async json() {
      return {};
    }
  });

  const { reindexProduct } = require('../src/modules/rag/ragIndex.service');
  await assert.rejects(() => reindexProduct(12), /Gemini embedding failed with 503/);

  assert.equal(staleDeletes.some((deleteQuery) => deleteQuery.params[0] === 'product' && deleteQuery.params[1] === 12), true);
  assert.equal(
    insertedChunks.some((insertQuery) => insertQuery.params[0] === 'product' && insertQuery.params.includes('needs_reindex')),
    true
  );
});

test('retrieveContext returns policy chunks without product cards for returns question', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: true,
    async json() {
      return { embedding: { values: Array.from({ length: 768 }, () => 0.1) } };
    }
  });

  const { retrieveContext } = require('../src/modules/rag/ragRetrieval.service');
  const result = await retrieveContext({ message: 'Shop đổi trả như thế nào?', filters: {}, limit: 6 });

  assert.equal(result.products.length, 0);
  assert.equal(result.sources.some((source) => source.type === 'document'), true);
});

test('retrieveContext removes product chunks from context when filters remove the product card', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  retrievalRows = [
    {
      id: '201',
      source_type: 'product',
      source_id: '12',
      title: 'Solely Trail Guard',
      content: 'Giày trail nam cho trekking cuối tuần.',
      metadata: { productId: 12, slug: 'trail-guard-pro', category: 'trail', gender: 'men' },
      score: '0.94'
    },
    {
      id: '202',
      source_type: 'document',
      source_id: '4',
      title: 'Đổi trả',
      content: 'Chính sách đổi trả áp dụng cho sản phẩm còn nguyên tình trạng.',
      metadata: { documentType: 'returns', slug: 'doi-tra' },
      score: '0.86'
    }
  ];
  global.fetch = async () => ({
    ok: true,
    async json() {
      return { embedding: { values: Array.from({ length: 768 }, () => 0.1) } };
    }
  });

  const { retrieveContext } = require('../src/modules/rag/ragRetrieval.service');
  const result = await retrieveContext({ message: 'Tìm giày nữ size 37', filters: { gender: 'women', size: '37' }, limit: 6 });

  assert.equal(result.products.length, 0);
  assert.equal(result.chunks.some((chunk) => chunk.sourceType === 'product'), false);
  assert.equal(result.sources.some((source) => source.type === 'product'), false);
  assert.equal(result.sources.some((source) => source.type === 'document'), true);
});

test('reindexDocument stores document chunks with embeddings', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: true,
    async json() {
      return { embedding: { values: Array.from({ length: 768 }, () => 0.1) } };
    }
  });

  const { reindexDocument } = require('../src/modules/rag/ragIndex.service');
  const result = await reindexDocument(4);

  assert.equal(result.status, 'indexed');
  assert.equal(result.chunksIndexed >= 1, true);
  assert.equal(staleDeletes.some((deleteQuery) => deleteQuery.params[0] === 'document' && deleteQuery.params[1] === 4), true);
  assert.equal(insertedChunks.some((insertQuery) => insertQuery.params[0] === 'document'), true);
});

test('reindexAll reports indexed products and documents', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: true,
    async json() {
      return { embedding: { values: Array.from({ length: 768 }, () => 0.1) } };
    }
  });

  const { reindexAll } = require('../src/modules/rag/ragIndex.service');
  const result = await reindexAll();

  assert.deepEqual(result, { productsIndexed: 2, documentsIndexed: 1, failed: [] });
});

test('answerWithRag returns greeting without product cards or sources', async () => {
  const { answerWithRag } = require('../src/modules/rag/rag.service');
  const result = await answerWithRag({ user: { id: 1 }, message: 'alo' });

  assert.deepEqual(result, {
    answer: 'Em đây, anh muốn tìm giày theo mục đích, size, ngân sách hay hỏi chính sách mua hàng nào?',
    products: [],
    sources: []
  });
});
