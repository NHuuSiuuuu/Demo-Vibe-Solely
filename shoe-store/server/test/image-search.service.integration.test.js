const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const Module = require('node:module');
const path = require('node:path');
const { Client } = require('pg');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');

function vector(...values) {
  return `[${[...values, ...Array(768 - values.length).fill(0)].join(',')}]`;
}

function runMigrations(databaseUrl) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'db-migrate.js')], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8'
  });
}

test('image search service integration uses real pgvector grouping, scopes, filters, and idempotent upsert', async (t) => {
  const databaseUrl = process.env.IMAGE_SEARCH_TEST_DATABASE_URL;
  if (!databaseUrl) {
    t.skip('IMAGE_SEARCH_TEST_DATABASE_URL is not set; integration test skipped to protect the application database');
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
  } catch (error) {
    t.skip(`configured PostgreSQL is unavailable: ${error.code || error.message}`);
    return;
  }

  const originalLoad = Module._load;
  const originalFetch = global.fetch;
  const productIds = [];
  const model = `image-search-integration-${Date.now()}-${process.pid}`;
  let embeddedVector = vector(1, 0);

  try {
    const extension = await client.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'");
    if (extension.rowCount !== 1) {
      t.skip('pgvector extension is not installed in IMAGE_SEARCH_TEST_DATABASE_URL');
      return;
    }

    const migration = runMigrations(databaseUrl);
    assert.equal(migration.status, 0, `migration failed: ${migration.stderr}`);

    Module._load = function patchedLoad(requestPath, parent, isMain) {
      if (requestPath === '../../db/pool' || requestPath.endsWith('/db/pool')) {
        return { query: (text, params) => client.query(text, params) };
      }
      if (requestPath === '../rag/gemini.client' || requestPath.endsWith('/rag/gemini.client')) {
        return {
          embedImage: async () => embeddedVector.slice(1, -1).split(',').map(Number),
          getImageEmbeddingConfig: () => ({ model, dimension: 768 })
        };
      }
      return originalLoad.call(this, requestPath, parent, isMain);
    };
    const servicePath = require.resolve('../src/modules/imageSearch/imageSearch.service');
    delete require.cache[servicePath];
    const service = require(servicePath);

    async function createProduct({ suffix, status = 'active', brand = 'Solely', vectorValue, embeddingModel = model, imageCount = 1 }) {
      const product = await client.query(
        `INSERT INTO products (slug, name, description, brand, category, gender, base_price, status)
         VALUES ($1, $2, 'integration product', $3, 'running', 'women', 2000000, $4)
         RETURNING id`,
        [`image-search-${suffix}-${model}`, `Image Search ${suffix}`, brand, status]
      );
      const productId = product.rows[0].id;
      productIds.push(productId);
      await client.query(
        `INSERT INTO product_variants (product_id, sku, size, color, stock_quantity, discount_percent)
         VALUES ($1, $2, '38', 'white', 5, 10)`,
        [productId, `IMG-${suffix}-${Date.now()}`]
      );
      const imageIds = [];
      for (let index = 0; index < imageCount; index += 1) {
        const image = await client.query(
          `INSERT INTO product_images (product_id, image_url, alt_text, sort_order)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [productId, `https://example.test/${suffix}-${index}.jpg`, `${suffix} ${index}`, index]
        );
        imageIds.push(image.rows[0].id);
      }
      for (let index = 0; index < imageIds.length; index += 1) {
        const value = Array.isArray(vectorValue) ? vectorValue[index] : vectorValue;
        await client.query(
          `INSERT INTO product_image_embeddings
            (product_id, product_image_id, embedding, embedding_model, status)
           VALUES ($1, $2, $3::vector, $4, 'active')`,
          [productId, imageIds[index], value, embeddingModel]
        );
      }
      return { productId, imageIds };
    }

    const target = await createProduct({ suffix: 'target', vectorValue: [vector(0.8, 0.6), vector(1, 0)], imageCount: 2 });
    await createProduct({ suffix: 'weak', vectorValue: vector(0, 1) });
    await createProduct({ suffix: 'hidden', status: 'hidden', vectorValue: vector(1, 0) });
    await createProduct({ suffix: 'wrong-brand', brand: 'Other', vectorValue: vector(0.99, 0.01) });
    await createProduct({ suffix: 'wrong-model', vectorValue: vector(1, 0), embeddingModel: `${model}-old` });

    const unfiltered = await service.searchProductsByImage({ data: Buffer.from('query'), mimeType: 'image/jpeg', filters: {} });
    assert.equal(unfiltered.products.filter((product) => product.id === Number(target.productId)).length, 1);
    assert.equal(unfiltered.products.find((product) => product.id === Number(target.productId)).similarityScore, 1);
    assert.equal(unfiltered.products.some((product) => product.name.includes('weak')), false);
    assert.equal(unfiltered.products.some((product) => product.name.includes('hidden')), false);
    assert.equal(unfiltered.products.some((product) => product.name.includes('wrong-model')), false);

    const filtered = await service.searchProductsByImage({
      data: Buffer.from('query'),
      mimeType: 'image/png',
      filters: { brand: 'Solely', gender: 'women', size: '38', color: 'white', minPrice: 1700000, maxPrice: 1900000 }
    });
    assert.deepEqual(filtered.products.map((product) => product.id), [Number(target.productId)]);

    global.fetch = async () => new Response(Buffer.from('catalog'), { headers: { 'content-type': 'image/jpeg' } });
    embeddedVector = vector(0.8, 0.6);
    await service.indexProductImage({ productId: Number(target.productId), productImageId: Number(target.imageIds[0]), imageUrl: 'https://example.test/catalog.jpg' });
    embeddedVector = vector(1, 0);
    await service.indexProductImage({ productId: Number(target.productId), productImageId: Number(target.imageIds[0]), imageUrl: 'https://example.test/catalog.jpg' });
    const upserted = await client.query(
      `SELECT COUNT(*)::int AS count, embedding <=> $1::vector AS distance
       FROM product_image_embeddings
       WHERE product_image_id = $2 AND embedding_model = $3
       GROUP BY embedding`,
      [vector(1, 0), target.imageIds[0], model]
    );
    assert.equal(upserted.rows[0].count, 1);
    assert.equal(Number(upserted.rows[0].distance), 0);
  } finally {
    Module._load = originalLoad;
    global.fetch = originalFetch;
    for (const productId of productIds.reverse()) {
      await client.query('DELETE FROM products WHERE id = $1', [productId]).catch(() => {});
    }
    await client.end();
  }
});
