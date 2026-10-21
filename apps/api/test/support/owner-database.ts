import { Client } from 'pg';

import { getTestDatabaseUrl } from './test-database.js';

/**
 * Owner connection for test fixtures that the application role cannot write, such as the read-only
 * `plans` reference table. The database name is taken from TEST_DATABASE_URL and must end with
 * `_test` (checked by getTestDatabaseUrl); only the role credentials come from the migration URL.
 */
function getOwnerTestDatabaseUrl(): string {
  const appUrl = getTestDatabaseUrl();
  const migrationUrl = process.env.MIGRATION_DATABASE_URL;

  if (migrationUrl === undefined || migrationUrl.trim() === '') {
    throw new Error('MIGRATION_DATABASE_URL is not set; cannot prepare owner-only test fixtures');
  }

  const ownerUrl = new URL(appUrl);
  const ownerCredentials = new URL(migrationUrl);
  ownerUrl.username = ownerCredentials.username;
  ownerUrl.password = ownerCredentials.password;

  return ownerUrl.toString();
}

export async function withOwnerTestClient<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: getOwnerTestDatabaseUrl() });
  await client.connect();

  try {
    return await work(client);
  } finally {
    await client.end();
  }
}
