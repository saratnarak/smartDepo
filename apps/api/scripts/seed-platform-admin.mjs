// Seeds exactly one platform admin from environment variables. Never hard-code credentials.
// Uses the owner connection because roles are read-only for the app role and the users table is
// RLS-protected outside a tenant transaction.
//
// Required: PLATFORM_ADMIN_NAME, PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD (min 12 chars).
// Optional: PLATFORM_ADMIN_PHONE.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { Client } from 'pg';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../..');

config({ path: resolve(repoRoot, '.env'), quiet: true });

const name = (process.env.PLATFORM_ADMIN_NAME ?? '').trim();
const email = (process.env.PLATFORM_ADMIN_EMAIL ?? '').trim().toLowerCase();
const phone = (process.env.PLATFORM_ADMIN_PHONE ?? '').trim() || null;
const password = process.env.PLATFORM_ADMIN_PASSWORD ?? '';
const databaseUrl = process.env.MIGRATION_DATABASE_URL;

if (name.length < 2) {
  throw new Error('PLATFORM_ADMIN_NAME is required (min 2 characters)');
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('PLATFORM_ADMIN_EMAIL is required and must be a valid email');
}
if (password.length < 12) {
  throw new Error('PLATFORM_ADMIN_PASSWORD is required and must be at least 12 characters');
}
if (databaseUrl === undefined || databaseUrl.trim() === '') {
  throw new Error('MIGRATION_DATABASE_URL is not set');
}

const passwordHash = await bcrypt.hash(password, 12);
const client = new Client({ connectionString: databaseUrl });

await client.connect();

try {
  await client.query('BEGIN');

  const role = await client.query("SELECT id FROM roles WHERE code = 'PLATFORM_ADMIN' LIMIT 1");

  if (role.rowCount === 0) {
    throw new Error('PLATFORM_ADMIN role not found; run the migrations first');
  }

  const result = await client.query(
    `INSERT INTO users
       (id, depot_id, role_id, name, email, phone, password_hash, is_active, updated_at)
     VALUES
       (gen_random_uuid(), NULL, $1, $2, $3, $4, $5, true, now())
     ON CONFLICT (email) DO UPDATE SET
       depot_id = NULL,
       role_id = EXCLUDED.role_id,
       name = EXCLUDED.name,
       phone = EXCLUDED.phone,
       password_hash = EXCLUDED.password_hash,
       is_active = true,
       failed_login_attempts = 0,
       locked_until = NULL,
       updated_at = now()
     RETURNING id, email`,
    [role.rows[0].id, name, email, phone, passwordHash],
  );

  await client.query('COMMIT');
  console.log(
    `Platform admin ready: ${String(result.rows[0].email)} (${String(result.rows[0].id)})`,
  );
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
