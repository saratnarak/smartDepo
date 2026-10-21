import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';

import { AppModule } from '../app.module.js';

/**
 * Creates the Nest application context that the sample data generator uses. The generator needs
 * the real services, so the demo data follows the same rules as the running API: the same invoice
 * numbers, the same stock ledger signs, the same batch allocation, and the same payment
 * allocations.
 */
export async function createSeedContext(): Promise<INestApplicationContext> {
  return NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
}
