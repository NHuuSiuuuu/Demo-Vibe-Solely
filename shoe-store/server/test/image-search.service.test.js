const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

const originalLoad = Module._load;
const originalFetch = global.fetch;

let queries = [];
let queryHandler;
let embeddedInputs = [];
let embedImageHandler;
let imageModel = 'gemini-embedding-2';

async function mockQuery(text, params = []) {
  queries.push({ text, params });
  if (!queryHandler) throw new Error(`Unexpected SQL in image search service test: ${text}`);
  return queryHandler(text, params);
}

const geminiMock = {
  embedImage(input) {
    embeddedInputs.push(input);
    return embedImageHandler(input);
  },
  getImageEmbeddingConfig() {
    return { model: imageModel, dimension: 768 };
  }
};

Module._load = function patchedLoad(requestPath, parent, isMain) {
  if (requestPath === '../../db/pool' || requestPath.endsWith('/db/pool')) {
    return { query: mockQuery };
  }
  if (requestPath === '../rag/gemini.client' || requestPath.endsWith('/rag/gemini.client')) {
    return geminiMock;
  }
  return originalLoad.call(this, requestPath, parent, isMain);
};

const service = require('../src/modules/imageSearch/imageSearch.service');

function vector(value = 0.1) {
  return Array.from({ length: 768 }, () => value);
}

function responseForImage(data, mimeType = 'image/jpeg') {
  const chunks = Array.isArray(data) ? data : [data];
  let index = 0;
  return {
    ok: true,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? mimeType : null) },
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) return { done: true, value: undefined };
            const value = Buffer.from(chunks[index]);
            index += 1;
            return { done: false, value };
          },
          async cancel() {},
          releaseLock() {}
        };
      }
    }
  };
}

function trackedResponse({
  data = 'catalog-image',
  mimeType = 'image/jpeg',
  ok = true,
  streamable = true,
  read
} = {}) {
  const chunks = Array.isArray(data) ? data : [data];
  const state = {
    cancelled: 0,
    released: 0,
    readCalls: 0
  };
  let index = 0;

  const body = streamable
    ? {
        getReader() {
          return {
            async read() {
              state.readCalls += 1;
              if (read) return read();
              if (index >= chunks.length) return { done: true, value: undefined };
              const value = Buffer.from(chunks[index]);
              index += 1;
              return { done: false, value };
            },
            async cancel() {
              state.cancelled += 1;
            },
            releaseLock() {
              state.released += 1;
            }
          };
        }
      }
    : {
        async cancel() {
          state.cancelled += 1;
        }
      };

  return {
    response: {
      ok,
      headers: {
        get(name) {
          if (name.toLowerCase() === 'content-type') return mimeType;
          return null;
        }
      },
      body
    },
    state
  };
}

test.beforeEach(() => {
  queries = [];
  embeddedInputs = [];
  imageModel = 'gemini-embedding-2';
  queryHandler = null;
  embedImageHandler = async () => vector();
  global.fetch = async () => responseForImage('catalog-image');
});

test.after(() => {
  Module._load = originalLoad;
  global.fetch = originalFetch;
});

test('image search service validates JPEG and PNG uploads without copying or storing bytes', () => {
  const jpeg = Buffer.from('jpeg');
  const png = Buffer.from('png');

  assert.deepEqual(service.validateImageInput({ buffer: jpeg, mimetype: 'image/jpeg', size: jpeg.length }), {
    data: jpeg,
    mimeType: 'image/jpeg'
  });
  assert.deepEqual(service.validateImageInput({ buffer: png, mimetype: 'image/png', size: png.length }), {
    data: png,
    mimeType: 'image/png'
  });
});

test('image search service rejects missing, unsupported, and oversized uploads with HTTP 400', () => {
  for (const [file, message] of [
    [undefined, /required/i],
    [{ buffer: Buffer.from('gif'), mimetype: 'image/gif', size: 3 }, /JPEG or PNG/i],
    [{ buffer: Buffer.alloc(1), mimetype: 'image/png', size: 8 * 1024 * 1024 + 1 }, /8 MB/i]
  ]) {
    assert.throws(
      () => service.validateImageInput(file),
      (error) => error.statusCode === 400 && message.test(error.message)
    );
  }
});

test('image search service indexes a catalog image with an idempotent parameterized upsert', async () => {
  queryHandler = async (text, params) => {
    assert.match(text, /INSERT INTO product_image_embeddings/);
    assert.match(text, /ON CONFLICT \(product_image_id, embedding_model\) DO UPDATE/);
    assert.match(text, /embedding = EXCLUDED\.embedding/);
    assert.deepEqual(params.slice(0, 3), [7, 71, '[0.1,' + Array.from({ length: 766 }, () => '0.1').join(',') + ',0.1]']);
    assert.deepEqual(params.slice(3), ['gemini-embedding-2', 'active', null]);
    return { rows: [], rowCount: 1 };
  };

  const result = await service.indexProductImage({
    productId: 7,
    productImageId: 71,
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/shoe.jpg'
  });

  assert.deepEqual(result, {
    status: 'active',
    productId: 7,
    productImageId: 71,
    embeddingModel: 'gemini-embedding-2'
  });
  assert.equal(embeddedInputs.length, 1);
  assert.equal(embeddedInputs[0].mimeType, 'image/jpeg');
  assert.deepEqual(embeddedInputs[0].data, Buffer.from('catalog-image'));
  assert.equal(queries.length, 1);
});

test('image search service records a safe error row when catalog download or provider embedding fails', async () => {
  const providerSecret = 'provider detail containing secret-token';
  embedImageHandler = async () => {
    throw new Error(providerSecret);
  };
  queryHandler = async (text, params) => {
    assert.match(text, /ON CONFLICT \(product_image_id, embedding_model\) DO UPDATE/);
    assert.equal(params[2], null);
    assert.equal(params[4], 'error');
    assert.equal(params[5], 'Không thể tạo embedding cho ảnh sản phẩm');
    assert.doesNotMatch(params.join(' '), /secret-token/);
    return { rows: [], rowCount: 1 };
  };

  const result = await service.indexProductImage({ productId: 8, productImageId: 81, imageUrl: 'https://example.test/a.png' });

  assert.deepEqual(result, {
    status: 'error',
    productId: 8,
    productImageId: 81,
    embeddingModel: 'gemini-embedding-2',
    errorMessage: 'Không thể tạo embedding cho ảnh sản phẩm'
  });
});

test('image search service aborts, cancels, and releases HTTP and MIME failure responses', async () => {
  queryHandler = async (text, params) => {
    assert.match(text, /INSERT INTO product_image_embeddings/);
    assert.equal(params[4], 'error');
    return { rows: [], rowCount: 1 };
  };

  for (const [productImageId, responseOptions] of [
    [201, { ok: false }],
    [202, { mimeType: 'image/gif' }]
  ]) {
    const { response, state } = trackedResponse(responseOptions);
    let requestSignal;
    global.fetch = async (_url, options) => {
      requestSignal = options.signal;
      return response;
    };

    const result = await service.indexProductImage({
      productId: 20,
      productImageId,
      imageUrl: `https://example.test/${productImageId}.jpg`
    });

    assert.equal(result.status, 'error');
    assert.equal(requestSignal.aborted, true);
    assert.equal(state.cancelled, 1);
    assert.equal(state.released, 1);
    assert.equal(state.readCalls, 0);
  }
  assert.equal(embeddedInputs.length, 0);
});

test('image search service aborts and cancels a non-streamable catalog response', async () => {
  const { response, state } = trackedResponse({ streamable: false });
  let requestSignal;
  global.fetch = async (_url, options) => {
    requestSignal = options.signal;
    return response;
  };
  queryHandler = async (_text, params) => {
    assert.equal(params[4], 'error');
    return { rows: [], rowCount: 1 };
  };

  const result = await service.indexProductImage({
    productId: 20,
    productImageId: 203,
    imageUrl: 'https://example.test/non-streamable.jpg'
  });

  assert.equal(result.status, 'error');
  assert.equal(requestSignal.aborted, true);
  assert.equal(state.cancelled, 1);
  assert.equal(embeddedInputs.length, 0);
});

test('image search service disables automatic redirects for catalog downloads', async () => {
  let redirectMode;
  global.fetch = async (_url, options) => {
    redirectMode = options.redirect;
    return responseForImage('catalog-image');
  };
  queryHandler = async () => ({ rows: [], rowCount: 1 });

  const result = await service.indexProductImage({
    productId: 20,
    productImageId: 204,
    imageUrl: 'https://example.test/redirect.jpg'
  });

  assert.equal(result.status, 'active');
  assert.equal(redirectMode, 'error');
});

test('image search service rejects non-HTTPS catalog URLs before fetch', async () => {
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    return responseForImage('image');
  };
  queryHandler = async (_text, params) => {
    assert.equal(params[4], 'error');
    return { rows: [], rowCount: 1 };
  };

  const result = await service.indexProductImage({
    productId: 21,
    productImageId: 211,
    imageUrl: 'http://example.test/insecure.jpg'
  });

  assert.equal(result.status, 'error');
  assert.equal(fetchCalls, 0);
  assert.equal(embeddedInputs.length, 0);
});

test('image search service stops streamed catalog downloads above eight megabytes', async () => {
  const firstChunk = Buffer.alloc(8 * 1024 * 1024);
  const secondChunk = Buffer.from([1]);
  const { response, state } = trackedResponse({ data: [firstChunk, secondChunk] });
  let requestSignal;
  global.fetch = async (_url, options) => {
    assert.equal(options.signal instanceof AbortSignal, true);
    requestSignal = options.signal;
    return response;
  };
  queryHandler = async (_text, params) => {
    assert.equal(params[4], 'error');
    return { rows: [], rowCount: 1 };
  };

  const result = await service.indexProductImage({
    productId: 22,
    productImageId: 221,
    imageUrl: 'https://example.test/oversized.jpg'
  });

  assert.equal(result.status, 'error');
  assert.equal(requestSignal.aborted, true);
  assert.equal(state.cancelled, 1);
  assert.equal(state.released, 1);
  assert.equal(embeddedInputs.length, 0);
});

test('image search service aborts a timed-out read and cleans up without waiting ten seconds', async () => {
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  let triggerTimeout;
  let clearedTimer;
  let requestSignal;

  global.setTimeout = (callback, delay) => {
    assert.equal(delay, 10_000);
    triggerTimeout = callback;
    return 73;
  };
  global.clearTimeout = (handle) => {
    clearedTimer = handle;
  };

  const { response, state } = trackedResponse({
    read: async () => {
      triggerTimeout();
      assert.equal(requestSignal.aborted, true);
      throw new Error('read aborted');
    }
  });
  global.fetch = async (_url, options) => {
    requestSignal = options.signal;
    return response;
  };
  queryHandler = async (_text, params) => {
    assert.equal(params[4], 'error');
    return { rows: [], rowCount: 1 };
  };

  try {
    const result = await service.indexProductImage({
      productId: 23,
      productImageId: 231,
      imageUrl: 'https://example.test/timeout.jpg'
    });

    assert.equal(result.status, 'error');
    assert.equal(requestSignal.aborted, true);
    assert.equal(state.cancelled, 1);
    assert.equal(state.released, 1);
    assert.equal(clearedTimer, 73);
    assert.equal(embeddedInputs.length, 0);
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }
});

test('image search service reindexes current product images and isolates individual failures', async () => {
  queryHandler = async (text, params) => {
    if (text.includes('FROM product_images')) {
      assert.deepEqual(params, [9]);
      return {
        rows: [
          { productId: '9', productImageId: '91', imageUrl: 'https://example.test/ok.jpg' },
          { productId: '9', productImageId: '92', imageUrl: 'https://example.test/fail.jpg' }
        ],
        rowCount: 2
      };
    }
    if (text.includes('INSERT INTO product_image_embeddings')) return { rows: [], rowCount: 1 };
    throw new Error(`Unexpected SQL: ${text}`);
  };
  embedImageHandler = async ({ data }) => {
    if (data.toString() === 'failed-image') throw new Error('provider unavailable');
    return vector();
  };
  global.fetch = async (url) => responseForImage(url.includes('/fail.') ? 'failed-image' : 'ok-image');

  assert.deepEqual(await service.reindexProductImages(9), { indexed: 1, failed: 1 });
});

test('image search service reindexes only images belonging to active products', async () => {
  let selectedActiveImages = false;
  queryHandler = async (text) => {
    if (text.includes('FROM product_images')) {
      selectedActiveImages = true;
      assert.match(text, /JOIN products p ON p\.id = pi\.product_id/);
      assert.match(text, /p\.status = 'active'/);
      return { rows: [{ productId: '10', productImageId: '101', imageUrl: 'https://example.test/active.png' }], rowCount: 1 };
    }
    if (text.includes('INSERT INTO product_image_embeddings')) return { rows: [], rowCount: 1 };
    throw new Error(`Unexpected SQL: ${text}`);
  };

  assert.deepEqual(await service.reindexAllProductImages(), { indexed: 1, failed: 0 });
  assert.equal(selectedActiveImages, true);
});

test('image search service collapses product images by best score and excludes hidden or weak matches in SQL', async () => {
  const queryImage = Buffer.from('query-image');
  queryHandler = async (text, params) => {
    assert.match(text, /MAX\(1 - \(pie\.embedding <=> \$1::vector\)\)/);
    assert.match(text, /p\.status = 'active'/);
    assert.match(text, /pie\.status = 'active'/);
    assert.match(text, /pie\.embedding_model = \$3/);
    assert.match(text, /HAVING MAX\(1 - \(pie\.embedding <=> \$1::vector\)\) >= \$2/);
    assert.match(text, /ORDER BY rp\.similarity_score DESC/);
    assert.deepEqual(params.slice(1, 3), [0.35, 'gemini-embedding-2']);
    return {
      rows: [{
        id: '12',
        name: 'Solely Runner',
        slug: 'solely-runner',
        brand: 'Solely',
        category: 'running',
        gender: 'unisex',
        basePrice: '2000000.00',
        imageUrl: '/runner.jpg',
        availableSizes: ['40', '41'],
        availableColors: ['white'],
        totalStock: '5',
        defaultVariantId: '120',
        discountPercent: '10.00',
        legacyPriceDelta: null,
        legacyPricingActive: false,
        defaultVariantStock: '5',
        similarityScore: '0.91'
      }],
      rowCount: 1
    };
  };

  const result = await service.searchProductsByImage({ data: queryImage, mimeType: 'image/png', filters: {}, limit: 12 });

  assert.equal(embeddedInputs[0].data, queryImage);
  assert.equal(result.threshold, 0.35);
  assert.deepEqual(result.products, [{
    id: 12,
    name: 'Solely Runner',
    slug: 'solely-runner',
    brand: 'Solely',
    category: 'running',
    gender: 'unisex',
    price: 1800000,
    discountPercent: 10,
    imageUrl: '/runner.jpg',
    availableSizes: ['40', '41'],
    availableColors: ['white'],
    totalStock: 5,
    defaultVariantId: 120,
    defaultVariantStock: 5,
    similarityScore: 0.91
  }]);
});

test('image search service parameterizes catalog filters and caps the result limit at twelve', async () => {
  const untrustedBrand = "Solely' OR 1=1 --";
  queryHandler = async (text, params) => {
    assert.doesNotMatch(text, /OR 1=1/);
    assert.match(text, /pie\.embedding_model = \$3/);
    assert.match(text, /LOWER\(p\.brand\) = LOWER\(\$4\)/);
    assert.match(text, /LOWER\(p\.gender\) = LOWER\(\$5\)/);
    assert.match(text, /matching_variant\.size = \$6/);
    assert.match(text, /LOWER\(matching_variant\.color\) = LOWER\(\$7\)/);
    assert.match(text, /displayed_price >= \$8/);
    assert.match(text, /displayed_price <= \$9/);
    assert.match(text, /LIMIT \$10/);
    assert.deepEqual(params.slice(1), [0.35, 'gemini-embedding-2', untrustedBrand, 'women', '38', 'white', '1000000.00', '2500000.00', 12]);
    return { rows: [], rowCount: 0 };
  };

  const result = await service.searchProductsByImage({
    data: Buffer.from('query'),
    mimeType: 'image/jpeg',
    filters: {
      brand: untrustedBrand,
      gender: 'women',
      size: '38',
      color: 'white',
      minPrice: '1000000',
      maxPrice: '2500000'
    },
    limit: 999
  });

  assert.deepEqual(result, { products: [], threshold: 0.35 });
});

test('image search service overview returns aggregate counts and public embedding config only', async () => {
  queryHandler = async (text, params) => {
    assert.match(text, /COUNT\(\*\) FILTER/);
    assert.match(text, /FROM product_images pi[\s\S]*JOIN products p ON p\.id = pi\.product_id[\s\S]*LEFT JOIN product_image_embeddings pie/);
    assert.match(text, /p\.status = 'active'/);
    assert.match(text, /pie\.embedding_model = \$1/);
    assert.doesNotMatch(text, /WHERE pie\.embedding_model/);
    assert.deepEqual(params, ['gemini-embedding-2']);
    return {
      rows: [{
        totalImages: '14',
        indexedCount: '10',
        errorCount: '2',
        needsReindexCount: '1',
        lastIndexedAt: '2026-09-07T09:00:00.000Z'
      }],
      rowCount: 1
    };
  };

  assert.deepEqual(await service.getImageEmbeddingOverview(), {
    totalImages: 14,
    indexedCount: 10,
    errorCount: 2,
    needsReindexCount: 1,
    model: 'gemini-embedding-2',
    dimension: 768,
    lastIndexedAt: '2026-09-07T09:00:00.000Z'
  });
});
