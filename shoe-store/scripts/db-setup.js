const { spawnSync } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(rootDir, 'server', '.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Set it in server/.env or export it before running db:setup.');
  process.exit(1);
}

for (const file of ['database/schema.sql', 'database/seed.sql']) {
  const result = spawnSync('psql', [process.env.DATABASE_URL, '-f', path.join(rootDir, file)], {
    stdio: 'inherit'
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
