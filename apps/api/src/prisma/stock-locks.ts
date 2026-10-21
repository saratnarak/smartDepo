import type { TenantScopedTransactionClient } from '../common/tenant/tenant-scope.js';

/**
 * Serializes stock-changing transactions for one depot and product. The lock is transaction-scoped
 * and released automatically on commit or rollback. Sales, adjustments, damage, and purchase
 * receiving must call this before reading the current stock so two requests cannot both pass the
 * negative-stock check.
 *
 * Raw SQL is kept in src/prisma (the only place ESLint allows it). Both ids are parameterized; no
 * value is interpolated into the SQL text.
 */
export async function lockStockProduct(
  transaction: TenantScopedTransactionClient,
  depotId: string,
  productId: string,
): Promise<void> {
  await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id"::text AS "id"
    FROM "products"
    WHERE "id" = ${productId}::uuid AND "depot_id" = ${depotId}::uuid
    FOR UPDATE
  `;
}
