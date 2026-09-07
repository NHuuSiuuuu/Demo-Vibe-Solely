const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
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
    basePrice: '2490000.00',
    discountPercent: '10.00',
    legacyPriceDelta: null,
    imageUrl: '/images/solely-trail-guard.jpg',
    availableSizes: ['42', '43'],
    availableColors: ['olive', 'gray'],
    totalStock: '12',
    variants: [
      { id: '121', sku: 'STG-42-OLV', size: '42', color: 'olive', stockQuantity: 6, discountPercent: '10.00', legacyPriceDelta: null },
      { id: '122', sku: 'STG-43-GRY', size: '43', color: 'gray', stockQuantity: 6, discountPercent: '30.00', legacyPriceDelta: null }
    ]
  },
  {
    id: '13',
    name: 'Solely Cloud Walker',
    slug: 'cloud-step-walker',
    description: 'Mục đích: đi bộ nhiều, du lịch, đứng lâu và sinh hoạt hằng ngày.',
    brand: 'Solely',
    category: 'walking',
    gender: 'women',
    basePrice: '1790000.00',
    discountPercent: '0.00',
    legacyPriceDelta: null,
    imageUrl: '/images/solely-cloud-walker.jpg',
    availableSizes: ['37', '38'],
    availableColors: ['gray', 'navy'],
    totalStock: '29',
    variants: [
      { sku: 'SCW-37-GRY', size: '37', color: 'gray', stockQuantity: 29, discountPercent: '0.00', legacyPriceDelta: null }
    ]
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
let productIndexQuery;

function resetStore() {
  insertedChunks = [];
  staleDeletes = [];
  documentIndexedAt = [];
  retrievalRows = defaultRetrievalRows;
  productIndexQuery = '';
}

async function mockQuery(text, params = []) {
  if (text.includes('FROM products p') && text.includes('WHERE p.id = $1')) {
    productIndexQuery = text;
    const row = productRows.find((product) => String(product.id) === String(params[0]));
    return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
  }

  if (text.includes('FROM rag_documents') && text.includes('WHERE id = $1')) {
    const row = documentRows.find((document) => String(document.id) === String(params[0]));
    return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
  }

  if (
    text.includes('FROM rag_documents') &&
    (text.includes("status = 'active'") || text.includes("status IN ('active', 'needs_reindex')"))
  ) {
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

test('Gemini chat request uses the Solely assistant instruction and complete output budget', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  let requestBody;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      async json() {
        return { candidates: [{ content: { parts: [{ text: 'Đã có câu trả lời đầy đủ.' }] } }] };
      }
    };
  };

  const { generateGroundedAnswer } = require('../src/modules/rag/gemini.client');
  const answer = await generateGroundedAnswer({ message: 'Chính sách cửa hàng?', context: 'Thông tin chính sách.', products: [] });

  assert.equal(answer, 'Đã có câu trả lời đầy đủ.');
  assert.match(requestBody.systemInstruction.parts[0].text, /trợ lý ảo chính thức của website Solely/);
  assert.match(requestBody.systemInstruction.parts[0].text, /Không dùng placeholder/);
  assert.equal(requestBody.generationConfig.maxOutputTokens, 1400);
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
  assert.match(insertedChunks[0].params[4], /Giá gốc: 2\.490\.000 ₫/);
  assert.match(insertedChunks[0].params[4], /Giá sau giảm: 2\.241\.000 ₫/);
  assert.match(insertedChunks[0].params[4], /Giảm: 10%/);
});

test('product index query executes with aggregated variants on PostgreSQL', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE TABLE products (
      id BIGINT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT NOT NULL,
      brand TEXT NOT NULL,
      category TEXT NOT NULL,
      gender TEXT NOT NULL,
      base_price NUMERIC(10, 2) NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE product_images (
      id BIGINT PRIMARY KEY,
      product_id BIGINT NOT NULL,
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );
    CREATE TABLE product_variants (
      id BIGINT PRIMARY KEY,
      product_id BIGINT NOT NULL,
      sku TEXT NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      stock_quantity INTEGER NOT NULL,
      discount_percent NUMERIC(5, 2) NOT NULL,
      legacy_pricing_active BOOLEAN NOT NULL DEFAULT FALSE
    );
    INSERT INTO products VALUES (12, 'Trail Guard', 'trail-guard', 'Giày trail', 'Solely', 'trail', 'men', 2490000, 'active');
    INSERT INTO product_images VALUES (1, 12, '/trail.jpg', 0);
    INSERT INTO product_variants VALUES (121, 12, 'STG-42', '42', 'olive', 6, 10, FALSE);
  `);
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: true,
    async json() {
      return { embedding: { values: Array.from({ length: 768 }, () => 0.1) } };
    }
  });
  const { reindexProduct } = require('../src/modules/rag/ragIndex.service');
  await reindexProduct(12);

  const result = await db.query(productIndexQuery, [12]);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].variants.length, 1);
  assert.equal(Number(result.rows[0].variants[0].discountPercent), 10);
});

test('RAG index and retrieved cards honor legacy retirement and whole-dong pricing', async () => {
  const savedProduct = structuredClone(productRows[0]);
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async () => ({ ok: true, async json() {
    return { embedding: { values: Array.from({ length: 768 }, () => 0.1) } };
  } });
  retrievalRows = [{ id: '201', source_type: 'product', source_id: '12', title: 'Trail Guard',
    content: 'Giày trail nam', metadata: { productId: 12 }, score: '0.94' }];
  const { reindexProduct } = require('../src/modules/rag/ragIndex.service');
  const { retrieveContext } = require('../src/modules/rag/ragRetrieval.service');
  try {
    productRows[0].basePrice = '101.00';
    productRows[0].variants = [{ ...savedProduct.variants[0], discountPercent: 0,
      legacyPriceDelta: '25.00', legacyPricingActive: true }];
    for (const [active, discount, expected] of [[true, 0, 126], [false, 0, 101], [false, 50, 51]]) {
      Object.assign(productRows[0].variants[0], { legacyPricingActive: active, discountPercent: discount });
      insertedChunks = [];
      await reindexProduct(12);
      assert.ok(insertedChunks.some((chunk) => chunk.params[4].includes(`Giá sau giảm: ${expected} ₫`)));
      const result = await retrieveContext({ message: 'Tìm giày trail', filters: {}, limit: 6 });
      assert.equal(result.products[0].price, expected);
    }
  } finally {
    productRows[0] = savedProduct;
  }
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

test('retrieveContext returns the backend-calculated discounted price in product cards', async () => {
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
    }
  ];
  global.fetch = async () => ({
    ok: true,
    async json() {
      return { embedding: { values: Array.from({ length: 768 }, () => 0.1) } };
    }
  });

  const { retrieveContext } = require('../src/modules/rag/ragRetrieval.service');
  const result = await retrieveContext({ message: 'Tìm giày trail đang giảm giá', filters: {}, limit: 6 });

  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].price, 2241000);
  assert.equal(result.products[0].discountPercent, 10);
  assert.equal(Object.hasOwn(result.products[0], 'priceDelta'), false);
});

test('retrieveContext prices and filters with the same size-matched variant', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  retrievalRows = [
    {
      id: '201',
      source_type: 'product',
      source_id: '12',
      title: 'Solely Trail Guard',
      content: 'Giày trail có nhiều size và mức giảm.',
      metadata: { productId: 12, slug: 'trail-guard-pro', category: 'trail', gender: 'men' },
      score: '0.94'
    }
  ];
  global.fetch = async () => ({
    ok: true,
    async json() {
      return { embedding: { values: Array.from({ length: 768 }, () => 0.1) } };
    }
  });

  const { retrieveContext } = require('../src/modules/rag/ragRetrieval.service');
  const result = await retrieveContext({
    message: 'Tìm giày size 43 dưới 1,8 triệu',
    filters: { size: '43', maxPrice: 1800000 },
    limit: 6
  });

  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].price, 1743000);
  assert.equal(result.products[0].discountPercent, 30);
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

test('reindexAll retries documents marked needs_reindex', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  documentRows[0].status = 'needs_reindex';
  global.fetch = async () => ({
    ok: true,
    async json() {
      return { embedding: { values: Array.from({ length: 768 }, () => 0.1) } };
    }
  });

  const { reindexAll } = require('../src/modules/rag/ragIndex.service');
  const result = await reindexAll();

  assert.equal(result.documentsIndexed, 1);
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
