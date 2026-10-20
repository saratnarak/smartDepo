import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../src/generated/prisma/client.js';

/**
 * Returns the test database URL only when it points at a database whose name ends with `_test`.
 * Database-backed tests and their setup script must call this so a misconfigured environment can
 * never run them against the development database (AGENTS.md section 4).
 */
export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;

  if (url === undefined || url.trim() === '') {
    throw new Error('TEST_DATABASE_URL is not set; refusing to run database-backed tests');
  }

  const databaseName = new URL(url).pathname.replace(/^\//, '');

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run database-backed tests: database "${databaseName}" does not end with _test`,
    );
  }

  return url;
}

export function createTestPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: getTestDatabaseUrl() }),
  });
}
