const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

function clearModule(relativePath) {
  delete require.cache[require.resolve(relativePath)];
}

test('query delegates to a PostgreSQL pool configured with DATABASE_URL', async () => {
  const originalLoad = Module._load;
  const createdPools = [];
  const expectedResult = { rows: [{ ok: true }] };

  process.env.DATABASE_URL = 'postgres://shoe-store-test';
  clearModule('../src/config/env');

  Module._load = function load(request, parent, isMain) {
    if (request === 'pg') {
      return {
        Pool: class Pool {
          constructor(options) {
            this.options = options;
            createdPools.push(this);
          }

          query(text, params) {
            this.lastQuery = { text, params };
            return Promise.resolve(expectedResult);
          }
        }
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    clearModule('../src/db/pool');
    const { pool, query } = require('../src/db/pool');
    const result = await query('select $1::int as value', [42]);

    assert.equal(pool, createdPools[0]);
    assert.deepEqual(pool.options, { connectionString: 'postgres://shoe-store-test' });
    assert.deepEqual(pool.lastQuery, { text: 'select $1::int as value', params: [42] });
    assert.equal(result, expectedResult);
  } finally {
    Module._load = originalLoad;
    clearModule('../src/db/pool');
    clearModule('../src/config/env');
  }
});

test('withTransaction commits successful callbacks and releases the client', async () => {
  const queries = [];
  const client = {
    query(sql) {
      queries.push(sql);
      return Promise.resolve();
    },
    releaseCalled: false,
    release() {
      this.releaseCalled = true;
    }
  };
  const poolPath = path.resolve(__dirname, '../src/db/pool.js');

  require.cache[poolPath] = {
    id: poolPath,
    filename: poolPath,
    loaded: true,
    exports: { pool: { connect: async () => client } }
  };
  clearModule('../src/db/transactions');

  const { withTransaction } = require('../src/db/transactions');
  const result = await withTransaction(async (transactionClient) => {
    assert.equal(transactionClient, client);
    await transactionClient.query('select 1');
    return 'created-order';
  });

  assert.equal(result, 'created-order');
  assert.deepEqual(queries, ['BEGIN', 'select 1', 'COMMIT']);
  assert.equal(client.releaseCalled, true);

  clearModule('../src/db/transactions');
  delete require.cache[poolPath];
});

test('withTransaction rolls back failed callbacks and releases the client', async () => {
  const queries = [];
  const client = {
    query(sql) {
      queries.push(sql);
      return Promise.resolve();
    },
    releaseCalled: false,
    release() {
      this.releaseCalled = true;
    }
  };
  const poolPath = path.resolve(__dirname, '../src/db/pool.js');
  const failure = new Error('payment declined');

  require.cache[poolPath] = {
    id: poolPath,
    filename: poolPath,
    loaded: true,
    exports: { pool: { connect: async () => client } }
  };
  clearModule('../src/db/transactions');

  const { withTransaction } = require('../src/db/transactions');

  await assert.rejects(
    () => withTransaction(async () => {
      throw failure;
    }),
    failure
  );

  assert.deepEqual(queries, ['BEGIN', 'ROLLBACK']);
  assert.equal(client.releaseCalled, true);

  clearModule('../src/db/transactions');
  delete require.cache[poolPath];
});
