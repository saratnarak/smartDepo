import { config } from 'dotenv';
import { resolve } from 'node:path';

/**
 * Loads environment variables for the API. The single .env file lives at the repository root;
 * the API package runs from apps/api. Real environment variables always win over .env values.
 */
export function loadEnv(): void {
  config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  config({ quiet: true });
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
