import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig, env } from 'prisma/config';

// The single .env file lives at the repository root; the API package runs from apps/api.
// Prisma CLI commands (migrate, generate, validate) connect as the owner role. The running API
// connects separately with DATABASE_URL (smartdepo_app) through PrismaService.
config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
config({ quiet: true });

export default defineConfig({
  schema: 'src/prisma/schema.prisma',
  migrations: {
    path: 'src/prisma/migrations',
  },
  datasource: {
    url: env('MIGRATION_DATABASE_URL'),
  },
});
