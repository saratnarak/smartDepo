/**
 * Prisma model names of tables that carry depot_id. Every query through these models must go
 * through the tenant scope; platform-level models (Depot, Plan, Role) do not.
 *
 * Keep this list in sync with the @@map("...") tables in schema.prisma that have depot_id.
 */
export const DEPOT_SCOPED_MODELS: ReadonlySet<string> = new Set([
  'Subscription',
  'User',
  'Category',
  'Product',
  'ProductUnit',
  'Price',
  'PriceHistory',
  'Batch',
  'StockMovement',
  'Customer',
  'SalesOrder',
  'SaleItem',
  'SaleItemBatch',
  'Payment',
  'PaymentAllocation',
  'Supplier',
  'PurchaseOrder',
  'PurchaseItem',
  'AuditLog',
]);

export function isDepotScopedModel(model: string): boolean {
  return DEPOT_SCOPED_MODELS.has(model);
}
