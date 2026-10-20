process.env.NODE_ENV ??= 'test';

// Load the repository-root .env so database-backed tests can reach TEST_DATABASE_URL. dotenv does
// not override variables that are already set, so CI-provided values win.
try {
  const { resolve } = require('node:path');
  require('dotenv').config({ path: resolve(__dirname, '../../../.env'), quiet: true });
} catch {
  // dotenv is a runtime dependency of the API; if it is missing, fall back to dummy values below.
}

// Unit tests never connect, so a dummy URL is fine when no .env is present (for example in CI).
process.env.DATABASE_URL ??=
  'postgresql://smartdepo:test@localhost:5432/smartdepo_test?schema=public';
