const { spawnSync } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(rootDir, 'server', '.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Set it in server/.env or export it before running db:migrate.');
  process.exit(1);
}

const migration = path.join(rootDir, 'database/migrations/20260907-product-catalog-admin.sql');
const result = spawnSync('psql', [process.env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-f', migration], {
  stdio: 'inherit'
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status || 0);
