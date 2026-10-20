// Prepares the test database before the integration (test:tenant) suite runs:
//   1. Refuses to run unless the database name ends with `_test`.
//   2. Resets the test database and applies all migrations using the owner role (credentials are
//      taken from MIGRATION_DATABASE_URL; only the database name/host come from TEST_DATABASE_URL).
//   3. Truncates every table so each run starts clean.
//   4. Grants the app role access to the tables (test databases do not carry the default privileges
//      set up for development).
//
// No credentials are printed. Run with `pnpm --filter api test:tenant`.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { config } from 'dotenv';
import { Client } from 'pg';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(scriptDir, '../..');
const repoRoot = resolve(apiDir, '../..');

config({ path: resolve(repoRoot, '.env'), quiet: true });

const appUrl = process.env.TEST_DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;

if (appUrl === undefined || appUrl.trim() === '') {
  throw new Error('TEST_DATABASE_URL is not set; cannot prepare the test database');
}
if (migrationUrl === undefined || migrationUrl.trim() === '') {
  throw new Error('MIGRATION_DATABASE_URL is not set; cannot apply migrations');
}

const app = new URL(appUrl);
const appDatabase = app.pathname.replace(/^\//, '');

if (!appDatabase.endsWith('_test')) {
  throw new Error(`Refusing to prepare database "${appDatabase}": the name must end with _test`);
}

// Owner connection to the test database: owner credentials, test database name.
const owner = new URL(appUrl);
const ownerCredentials = new URL(migrationUrl);
owner.username = ownerCredentials.username;
owner.password = ownerCredentials.password;

const ownerUrl = owner.toString();
const appRole = app.username;
const ownerRole = ownerCredentials.username;

for (const role of [appRole, ownerRole]) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(role)) {
    throw new Error('The test or migration database URL contains an unexpected role name');
  }
}

// Prisma refuses `migrate reset` for AI agents, so reset the guarded test schema directly: this
// drops only the public schema of smartdepo_test (never the development database) and recreates it
// owned by the migration role. Migrations then apply to an empty schema.
console.log(`[test-db] resetting schema in ${appDatabase}`);
const resetClient = new Client({ connectionString: ownerUrl });
await resetClient.connect();
try {
  await resetClient.query('DROP SCHEMA IF EXISTS public CASCADE');
  await resetClient.query('CREATE SCHEMA public');
  await resetClient.query(`ALTER SCHEMA public OWNER TO "${ownerRole}"`);
} finally {
  await resetClient.end();
}

console.log(`[test-db] applying migrations to ${appDatabase}`);
const migrate = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
  cwd: apiDir,
  env: { ...process.env, MIGRATION_DATABASE_URL: ownerUrl },
  stdio: 'inherit',
});

if (migrate.status !== 0) {
  throw new Error(`prisma migrate deploy failed with exit code ${String(migrate.status)}`);
}

const client = new Client({ connectionString: ownerUrl });
await client.connect();

try {
  const tables = await client.query(
    "select tablename from pg_tables where schemaname = 'public' order by tablename",
  );

  await client.query(`GRANT USAGE ON SCHEMA public TO "${appRole}"`);
  await client.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${appRole}"`,
  );
  await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${appRole}"`);

  // Keep reference tables read-only, matching the auth migration (the blanket grant above would
  // otherwise restore DML on plans/roles).
  await client.query(`REVOKE INSERT, UPDATE, DELETE ON TABLE plans, roles FROM "${appRole}"`);
  await client.query(`GRANT SELECT ON TABLE plans, roles TO "${appRole}"`);

  console.log(`[test-db] ${appDatabase} ready (${String(tables.rowCount)} tables, grants applied)`);
} finally {
  await client.end();
}
