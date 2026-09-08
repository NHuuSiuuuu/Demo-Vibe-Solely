const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
function run(result) {
  const calls = [];
  let exitCode;
  const stopped = new Error('process exited');
  try {
    vm.runInNewContext(fs.readFileSync(path.join(root, 'scripts/db-migrate.js'), 'utf8'), {
      __dirname: path.join(root, 'scripts'),
      require(name) {
        if (name === 'dotenv') return { config() {} };
        if (name === 'node:child_process') return {
          spawnSync(...args) { calls.push(args); return result; }
        };
        return require(name);
      },
      console: { error() {} },
      process: { env: { DATABASE_URL: 'postgres://test.invalid/migration' }, exit(code) { exitCode = code; throw stopped; } }
    });
  } catch (error) {
    if (error !== stopped) throw error;
  }
  return { calls, exitCode };
}

test('actual migration runner invokes both migrations in dependency order with SQL error stopping', () => {
  const { calls, exitCode } = run({ status: 0 });
  assert.equal(exitCode, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [[
    'psql', ['postgres://test.invalid/migration', '-v', 'ON_ERROR_STOP=1',
      '-f', path.join(root, 'database/migrations/20260907-product-catalog-admin.sql'),
      '-f', path.join(root, 'database/migrations/20260907-vnpay-discount.sql'),
      '-f', path.join(root, 'database/migrations/20260907-refund-status.sql'),
      '-f', path.join(root, 'database/migrations/20260907-product-image-search.sql')],
    { stdio: 'inherit' }
  ]]);
});

test('migration runner propagates SQL failure', () => assert.equal(run({ status: 3 }).exitCode, 3));
test('migration runner fails on spawn error', () => assert.equal(run({ error: new Error('psql missing') }).exitCode, 1));
test('migration runner fails when psql is terminated by a signal', () => assert.equal(run({ status: null, signal: 'SIGTERM' }).exitCode, 1));
