import type { TenantScopedTransactionClient } from '../common/tenant/tenant-scope.js';

/**
 * Serialises the invoice number counter of one depot. The lock is transaction scoped, so it is
 * released when the transaction ends, and every invoice of the depot waits for the same key. That
 * keeps the numbers sequential even when two sales staff create invoices at the same time.
 *
 * Raw SQL is kept in src/prisma (the only place ESLint allows it). The key is parameterized.
 */
export async function lockInvoiceCounter(
  transaction: TenantScopedTransactionClient,
  depotId: string,
): Promise<void> {
  // The lock function returns void, which Prisma cannot read, so it is wrapped in a sub-select
  // that returns a constant column. The lock itself is what matters.
  await transaction.$queryRaw`
    SELECT 1 AS "locked"
    FROM (SELECT pg_advisory_xact_lock(hashtext(${`invoice-number:${depotId}`}))) AS "depot_lock"
  `;
}
