import { Prisma } from '../generated/prisma/client.js';
import type { TenantScopedTransactionClient } from '../common/tenant/tenant-scope.js';

/**
 * The report queries.
 *
 * Every statement is parameterized and every statement filters on the depot id of the caller, so a
 * report can never read the data of another depot. The tenant session and the row-level security
 * policies are the second layer on top of that (AGENTS.md sections 6.1 and 7).
 *
 * The local time of Phnom Penh is used for every grouping, so a day of the report is the day in the
 * depot and not the day in UTC.
 */

export const DEPOT_TIME_ZONE = 'Asia/Phnom_Penh';

export interface SalesPeriodRow {
  period: string;
  period_start: Date;
  invoice_count: number;
  subtotal: string;
  discount_total: string;
  total: string;
  paid: string;
  outstanding: string;
}

export interface SalesProductRow {
  product_id: string;
  sku: string;
  name: string;
  category_name: string | null;
  quantity_base: string;
  revenue: string;
  cost: string;
  profit: string;
}

export interface SalesGroupRow {
  group_id: string;
  name: string;
  detail: string | null;
  invoice_count: number;
  subtotal: string;
  discount_total: string;
  total: string;
  paid: string;
  outstanding: string;
}

export interface InventoryRow {
  product_id: string;
  sku: string;
  name: string;
  category_name: string | null;
  is_active: boolean;
  track_batches: boolean;
  reorder_level: string;
  cost_price: string;
  current_stock: string;
}

export interface BatchStockRow {
  batch_id: string;
  product_id: string;
  batch_number: string;
  expiry_date: Date | null;
  stock: string;
}

export interface CreditRow {
  customer_id: string;
  name: string;
  type: string;
  credit_limit: string | null;
  payment_term_days: number | null;
  total_invoiced: string;
  paid: string;
  outstanding: string;
  invoice_count: number;
}

export interface CreditInvoiceRow {
  customer_id: string;
  invoice_id: string;
  invoice_number: string;
  due_date: Date | null;
  order_date: Date;
  total: string;
  paid: string;
  outstanding: string;
}

export interface PurchaseRow {
  supplier_id: string;
  name: string;
  period: string;
  period_start: Date;
  purchase_count: number;
  subtotal: string;
  total: string;
}

export interface SalesTrendRow {
  period: string;
  period_start: Date;
  total: string;
  invoice_count: number;
}

export interface WeekdayRow {
  weekday: number;
  total: string;
  invoice_count: number;
}

export interface SlowMovingRow {
  product_id: string;
  sku: string;
  name: string;
  current_stock: string;
  sold_quantity: string;
}

export interface PurchasesVersusSalesRow {
  period: string;
  period_start: Date;
  purchases: string;
  sales: string;
}

/**
 * The paid amount of every invoice of the depot. It is a fragment of SQL so that the parameter of
 * the depot id takes part in the numbering of the parameters of the whole statement.
 */
function paidJoin(depotId: string): Prisma.Sql {
  return Prisma.sql`
    LEFT JOIN (
      SELECT "sales_order_id", SUM("amount") AS "paid"
      FROM "payment_allocations"
      WHERE "depot_id" = ${depotId}
      GROUP BY "sales_order_id"
    ) AS "paid_rows" ON "paid_rows"."sales_order_id" = "so"."id"
  `;
}

export async function salesByPeriod(
  transaction: TenantScopedTransactionClient,
  depotId: string,
  unit: 'day' | 'week' | 'month',
  from: Date,
  to: Date,
): Promise<SalesPeriodRow[]> {
  const rows = await transaction.$queryRaw<SalesPeriodRow[]>(Prisma.sql`
    SELECT
      to_char(
        date_trunc(${unit}, "so"."order_date" AT TIME ZONE ${DEPOT_TIME_ZONE}),
        'YYYY-MM-DD'
      ) AS "period",
      date_trunc(${unit}, "so"."order_date" AT TIME ZONE ${DEPOT_TIME_ZONE})::date AS "period_start",
      COUNT(*)::int AS "invoice_count",
      COALESCE(SUM("so"."subtotal"), 0)::numeric AS "subtotal",
      COALESCE(SUM("so"."discount_total"), 0)::numeric AS "discount_total",
      COALESCE(SUM("so"."total"), 0)::numeric AS "total",
      COALESCE(SUM(COALESCE("paid_rows"."paid", 0)), 0)::numeric AS "paid",
      COALESCE(
        SUM("so"."total" - COALESCE("paid_rows"."paid", 0)),
        0
      )::numeric AS "outstanding"
    FROM "sales_orders" AS "so"
    ${paidJoin(depotId)}
    WHERE "so"."depot_id" = ${depotId}
      AND "so"."status" <> 'VOIDED'
      AND "so"."order_date" >= ${from}
      AND "so"."order_date" < ${to}
    GROUP BY 1, 2
    ORDER BY 2
  `);

  return rows;
}

export async function salesByProduct(
  transaction: TenantScopedTransactionClient,
  depotId: string,
  from: Date,
  to: Date,
): Promise<SalesProductRow[]> {
  const rows = await transaction.$queryRaw<SalesProductRow[]>(Prisma.sql`
    SELECT
      "p"."id" AS "product_id",
      "p"."sku" AS "sku",
      "p"."name" AS "name",
      "c"."name" AS "category_name",
      COALESCE(SUM("si"."quantity_base"), 0)::numeric AS "quantity_base",
      COALESCE(SUM("si"."line_total"), 0)::numeric AS "revenue",
      COALESCE(
        SUM("si"."quantity_base" * COALESCE("si"."cost_per_base_unit", 0)),
        0
      )::numeric AS "cost",
      COALESCE(
        SUM(
          "si"."line_total" - "si"."quantity_base" * COALESCE("si"."cost_per_base_unit", 0)
        ),
        0
      )::numeric AS "profit"
    FROM "sale_items" AS "si"
    JOIN "sales_orders" AS "so"
      ON "so"."id" = "si"."sale_order_id" AND "so"."depot_id" = "si"."depot_id"
    JOIN "products" AS "p" ON "p"."id" = "si"."product_id"
    LEFT JOIN "categories" AS "c" ON "c"."id" = "p"."category_id"
    WHERE "si"."depot_id" = ${depotId}
      AND "so"."status" <> 'VOIDED'
      AND "so"."order_date" >= ${from}
      AND "so"."order_date" < ${to}
    GROUP BY "p"."id", "p"."sku", "p"."name", "c"."name"
    ORDER BY "revenue" DESC, "p"."sku" ASC
  `);

  return rows;
}

export async function salesByCustomer(
  transaction: TenantScopedTransactionClient,
  depotId: string,
  from: Date,
  to: Date,
): Promise<SalesGroupRow[]> {
  const rows = await transaction.$queryRaw<SalesGroupRow[]>(Prisma.sql`
    SELECT
      "cu"."id" AS "group_id",
      "cu"."name" AS "name",
      "cu"."type"::text AS "detail",
      COUNT(*)::int AS "invoice_count",
      COALESCE(SUM("so"."subtotal"), 0)::numeric AS "subtotal",
      COALESCE(SUM("so"."discount_total"), 0)::numeric AS "discount_total",
      COALESCE(SUM("so"."total"), 0)::numeric AS "total",
      COALESCE(SUM(COALESCE("paid_rows"."paid", 0)), 0)::numeric AS "paid",
      COALESCE(
        SUM("so"."total" - COALESCE("paid_rows"."paid", 0)),
        0
      )::numeric AS "outstanding"
    FROM "sales_orders" AS "so"
    JOIN "customers" AS "cu" ON "cu"."id" = "so"."customer_id"
    ${paidJoin(depotId)}
    WHERE "so"."depot_id" = ${depotId}
      AND "so"."status" <> 'VOIDED'
      AND "so"."order_date" >= ${from}
      AND "so"."order_date" < ${to}
    GROUP BY "cu"."id", "cu"."name", "cu"."type"
    ORDER BY "total" DESC, "cu"."name" ASC
  `);

  return rows;
}

export async function salesByCategory(
  transaction: TenantScopedTransactionClient,
  depotId: string,
  from: Date,
  to: Date,
): Promise<SalesGroupRow[]> {
  const rows = await transaction.$queryRaw<SalesGroupRow[]>(Prisma.sql`
    SELECT
      COALESCE("p"."category_id"::text, 'uncategorised') AS "group_id",
      COALESCE("c"."name", 'Uncategorised') AS "name",
      COUNT(DISTINCT "so"."id")::int AS "invoice_count",
      COALESCE(SUM("so"."subtotal"), 0)::numeric AS "subtotal",
      COALESCE(SUM("so"."discount_total"), 0)::numeric AS "discount_total",
      COALESCE(SUM("so"."total"), 0)::numeric AS "total",
      COALESCE(SUM(COALESCE("paid_rows"."paid", 0)), 0)::numeric AS "paid",
      COALESCE(
        SUM("so"."total" - COALESCE("paid_rows"."paid", 0)),
        0
      )::numeric AS "outstanding"
    FROM "sales_orders" AS "so"
    JOIN "sale_items" AS "si"
      ON "si"."sale_order_id" = "so"."id" AND "si"."depot_id" = "so"."depot_id"
    JOIN "products" AS "p" ON "p"."id" = "si"."product_id"
    LEFT JOIN "categories" AS "c" ON "c"."id" = "p"."category_id"
    ${paidJoin(depotId)}
    WHERE "so"."depot_id" = ${depotId}
      AND "so"."status" <> 'VOIDED'
      AND "so"."order_date" >= ${from}
      AND "so"."order_date" < ${to}
    GROUP BY "p"."category_id", "c"."name"
    ORDER BY "total" DESC
  `);

  return rows;
}

export async function salesByStaff(
  transaction: TenantScopedTransactionClient,
  depotId: string,
  from: Date,
  to: Date,
): Promise<SalesGroupRow[]> {
  const rows = await transaction.$queryRaw<SalesGroupRow[]>(Prisma.sql`
    SELECT
      "u"."id" AS "group_id",
      "u"."name" AS "name",
      "role"."code"::text AS "detail",
      COUNT(*)::int AS "invoice_count",
      COALESCE(SUM("so"."subtotal"), 0)::numeric AS "subtotal",
      COALESCE(SUM("so"."discount_total"), 0)::numeric AS "discount_total",
      COALESCE(SUM("so"."total"), 0)::numeric AS "total",
      COALESCE(SUM(COALESCE("paid_rows"."paid", 0)), 0)::numeric AS "paid",
      COALESCE(
        SUM("so"."total" - COALESCE("paid_rows"."paid", 0)),
        0
      )::numeric AS "outstanding"
    FROM "sales_orders" AS "so"
    JOIN "users" AS "u" ON "u"."id" = "so"."created_by_id"
    JOIN "roles" AS "role" ON "role"."id" = "u"."role_id"
    ${paidJoin(depotId)}
    WHERE "so"."depot_id" = ${depotId}
      AND "so"."status" <> 'VOIDED'
      AND "so"."order_date" >= ${from}
      AND "so"."order_date" < ${to}
    GROUP BY "u"."id", "u"."name", "role"."code"
    ORDER BY "total" DESC, "u"."name" ASC
  `);

  return rows;
}

export async function inventoryRows(
  transaction: TenantScopedTransactionClient,
  depotId: string,
): Promise<InventoryRow[]> {
  const rows = await transaction.$queryRaw<InventoryRow[]>(Prisma.sql`
    SELECT
      "p"."id" AS "product_id",
      "p"."sku" AS "sku",
      "p"."name" AS "name",
      "c"."name" AS "category_name",
      "p"."is_active" AS "is_active",
      "p"."track_batches" AS "track_batches",
      "p"."reorder_level"::numeric AS "reorder_level",
      "p"."cost_price"::numeric AS "cost_price",
      COALESCE("stock_rows"."stock", 0)::numeric AS "current_stock"
    FROM "products" AS "p"
    LEFT JOIN "categories" AS "c" ON "c"."id" = "p"."category_id"
    LEFT JOIN (
      SELECT "product_id", SUM("quantity") AS "stock"
      FROM "stock_movements"
      WHERE "depot_id" = ${depotId}
      GROUP BY "product_id"
    ) AS "stock_rows" ON "stock_rows"."product_id" = "p"."id"
    WHERE "p"."depot_id" = ${depotId}
    ORDER BY "p"."name" ASC
  `);

  return rows;
}

export async function batchStockRows(
  transaction: TenantScopedTransactionClient,
  depotId: string,
  expiryBefore: Date,
): Promise<BatchStockRow[]> {
  const rows = await transaction.$queryRaw<BatchStockRow[]>(Prisma.sql`
    SELECT
      "b"."id" AS "batch_id",
      "b"."product_id" AS "product_id",
      "b"."batch_number" AS "batch_number",
      "b"."expiry_date" AS "expiry_date",
      COALESCE("stock_rows"."stock", 0)::numeric AS "stock"
    FROM "batches" AS "b"
    LEFT JOIN (
      SELECT "batch_id", SUM("quantity") AS "stock"
      FROM "stock_movements"
      WHERE "depot_id" = ${depotId}
      GROUP BY "batch_id"
    ) AS "stock_rows" ON "stock_rows"."batch_id" = "b"."id"
    WHERE "b"."depot_id" = ${depotId}
      AND "b"."expiry_date" IS NOT NULL
      AND "b"."expiry_date" <= ${expiryBefore}
    ORDER BY "b"."expiry_date" ASC
  `);

  return rows;
}

export async function creditRows(
  transaction: TenantScopedTransactionClient,
  depotId: string,
): Promise<CreditRow[]> {
  const rows = await transaction.$queryRaw<CreditRow[]>(Prisma.sql`
    SELECT
      "cu"."id" AS "customer_id",
      "cu"."name" AS "name",
      "cu"."type"::text AS "type",
      "cu"."credit_limit"::numeric AS "credit_limit",
      "cu"."payment_term_days" AS "payment_term_days",
      COALESCE(SUM("so"."total"), 0)::numeric AS "total_invoiced",
      COALESCE(SUM(COALESCE("paid_rows"."paid", 0)), 0)::numeric AS "paid",
      COALESCE(
        SUM("so"."total" - COALESCE("paid_rows"."paid", 0)),
        0
      )::numeric AS "outstanding",
      COUNT("so"."id")::int AS "invoice_count"
    FROM "customers" AS "cu"
    LEFT JOIN "sales_orders" AS "so"
      ON "so"."customer_id" = "cu"."id"
      AND "so"."depot_id" = "cu"."depot_id"
      AND "so"."status" <> 'VOIDED'
    LEFT JOIN (
      SELECT "sales_order_id", SUM("amount") AS "paid"
      FROM "payment_allocations"
      WHERE "depot_id" = ${depotId}
      GROUP BY "sales_order_id"
    ) AS "paid_rows" ON "paid_rows"."sales_order_id" = "so"."id"
    WHERE "cu"."depot_id" = ${depotId}
      AND "cu"."is_active" = true
    GROUP BY "cu"."id", "cu"."name", "cu"."type", "cu"."credit_limit", "cu"."payment_term_days"
    ORDER BY "outstanding" DESC, "cu"."name" ASC
  `);

  return rows;
}

export async function creditInvoiceRows(
  transaction: TenantScopedTransactionClient,
  depotId: string,
): Promise<CreditInvoiceRow[]> {
  const rows = await transaction.$queryRaw<CreditInvoiceRow[]>(Prisma.sql`
    SELECT
      "cu"."id" AS "customer_id",
      "so"."id" AS "invoice_id",
      "so"."invoice_number" AS "invoice_number",
      "so"."due_date" AS "due_date",
      "so"."order_date" AS "order_date",
      "so"."total"::numeric AS "total",
      COALESCE("paid_rows"."paid", 0)::numeric AS "paid",
      ("so"."total" - COALESCE("paid_rows"."paid", 0))::numeric AS "outstanding"
    FROM "sales_orders" AS "so"
    JOIN "customers" AS "cu" ON "cu"."id" = "so"."customer_id"
    LEFT JOIN (
      SELECT "sales_order_id", SUM("amount") AS "paid"
      FROM "payment_allocations"
      WHERE "depot_id" = ${depotId}
      GROUP BY "sales_order_id"
    ) AS "paid_rows" ON "paid_rows"."sales_order_id" = "so"."id"
    WHERE "so"."depot_id" = ${depotId}
      AND "so"."status" <> 'VOIDED'
      AND ("so"."total" - COALESCE("paid_rows"."paid", 0)) > 0
    ORDER BY "so"."due_date" ASC NULLS LAST, "so"."order_date" ASC
  `);

  return rows;
}

export async function purchasesBySupplier(
  transaction: TenantScopedTransactionClient,
  depotId: string,
  from: Date,
  to: Date,
): Promise<PurchaseRow[]> {
  const rows = await transaction.$queryRaw<PurchaseRow[]>(Prisma.sql`
    SELECT
      "s"."id" AS "supplier_id",
      "s"."name" AS "name",
      to_char(
        date_trunc(
          'month',
          COALESCE("po"."ordered_at", "po"."created_at") AT TIME ZONE ${DEPOT_TIME_ZONE}
        ),
        'YYYY-MM-DD'
      ) AS "period",
      date_trunc(
        'month',
        COALESCE("po"."ordered_at", "po"."created_at") AT TIME ZONE ${DEPOT_TIME_ZONE}
      )::date AS "period_start",
      COUNT(*)::int AS "purchase_count",
      COALESCE(SUM("po"."subtotal"), 0)::numeric AS "subtotal",
      COALESCE(SUM("po"."total"), 0)::numeric AS "total"
    FROM "purchase_orders" AS "po"
    JOIN "suppliers" AS "s" ON "s"."id" = "po"."supplier_id"
    WHERE "po"."depot_id" = ${depotId}
      AND "po"."status" = 'RECEIVED'
      AND COALESCE("po"."ordered_at", "po"."created_at") >= ${from}
      AND COALESCE("po"."ordered_at", "po"."created_at") < ${to}
    GROUP BY "s"."id", "s"."name", 3, 4
    ORDER BY 4 ASC, "total" DESC
  `);

  return rows;
}

export async function salesTotals(
  transaction: TenantScopedTransactionClient,
  depotId: string,
  from: Date,
  to: Date,
): Promise<{
  subtotal: string;
  discountTotal: string;
  total: string;
  invoiceCount: number;
  paid: string;
  outstanding: string;
}> {
  const rows = await transaction.$queryRaw<
    Array<{
      subtotal: string;
      discount_total: string;
      total: string;
      invoice_count: number;
      paid: string;
      outstanding: string;
    }>
  >(Prisma.sql`
    SELECT
      COALESCE(SUM("so"."subtotal"), 0)::numeric AS "subtotal",
      COALESCE(SUM("so"."discount_total"), 0)::numeric AS "discount_total",
      COALESCE(SUM("so"."total"), 0)::numeric AS "total",
      COUNT(*)::int AS "invoice_count",
      COALESCE(SUM(COALESCE("paid_rows"."paid", 0)), 0)::numeric AS "paid",
      COALESCE(
        SUM("so"."total" - COALESCE("paid_rows"."paid", 0)),
        0
      )::numeric AS "outstanding"
    FROM "sales_orders" AS "so"
    ${paidJoin(depotId)}
    WHERE "so"."depot_id" = ${depotId}
      AND "so"."status" <> 'VOIDED'
      AND "so"."order_date" >= ${from}
      AND "so"."order_date" < ${to}
  `);

  const row = rows[0];

  return {
    subtotal: row?.subtotal ?? '0',
    discountTotal: row?.discount_total ?? '0',
    total: row?.total ?? '0',
    invoiceCount: row?.invoice_count ?? 0,
    paid: row?.paid ?? '0',
    outstanding: row?.outstanding ?? '0',
  };
}

export async function profitTotals(
  transaction: TenantScopedTransactionClient,
  depotId: string,
  from: Date,
  to: Date,
): Promise<{ revenue: string; cost: string; profit: string }> {
  const rows = await transaction.$queryRaw<
    Array<{ revenue: string; cost: string; profit: string }>
  >(Prisma.sql`
    SELECT
      COALESCE(SUM("si"."line_total"), 0)::numeric AS "revenue",
      COALESCE(
        SUM("si"."quantity_base" * COALESCE("si"."cost_per_base_unit", 0)),
        0
      )::numeric AS "cost",
      COALESCE(
        SUM(
          "si"."line_total" - "si"."quantity_base" * COALESCE("si"."cost_per_base_unit", 0)
        ),
        0
      )::numeric AS "profit"
    FROM "sale_items" AS "si"
    JOIN "sales_orders" AS "so"
      ON "so"."id" = "si"."sale_order_id" AND "so"."depot_id" = "si"."depot_id"
    WHERE "si"."depot_id" = ${depotId}
      AND "so"."status" <> 'VOIDED'
      AND "so"."order_date" >= ${from}
      AND "so"."order_date" < ${to}
  `);

  const row = rows[0];

  return {
    revenue: row?.revenue ?? '0',
    cost: row?.cost ?? '0',
    profit: row?.profit ?? '0',
  };
}

export async function salesByWeekday(
  transaction: TenantScopedTransactionClient,
  depotId: string,
  from: Date,
  to: Date,
): Promise<WeekdayRow[]> {
  const rows = await transaction.$queryRaw<WeekdayRow[]>(Prisma.sql`
    SELECT
      EXTRACT(ISODOW FROM "so"."order_date" AT TIME ZONE ${DEPOT_TIME_ZONE})::int AS "weekday",
      COALESCE(SUM("so"."total"), 0)::numeric AS "total",
      COUNT(*)::int AS "invoice_count"
    FROM "sales_orders" AS "so"
    WHERE "so"."depot_id" = ${depotId}
      AND "so"."status" <> 'VOIDED'
      AND "so"."order_date" >= ${from}
      AND "so"."order_date" < ${to}
    GROUP BY 1
    ORDER BY 1
  `);

  return rows;
}

export async function slowMovingRows(
  transaction: TenantScopedTransactionClient,
  depotId: string,
  from: Date,
  to: Date,
): Promise<SlowMovingRow[]> {
  const rows = await transaction.$queryRaw<SlowMovingRow[]>(Prisma.sql`
    SELECT
      "p"."id" AS "product_id",
      "p"."sku" AS "sku",
      "p"."name" AS "name",
      COALESCE("stock_rows"."stock", 0)::numeric AS "current_stock",
      COALESCE("sold_rows"."sold", 0)::numeric AS "sold_quantity"
    FROM "products" AS "p"
    LEFT JOIN (
      SELECT "product_id", SUM("quantity") AS "stock"
      FROM "stock_movements"
      WHERE "depot_id" = ${depotId}
      GROUP BY "product_id"
    ) AS "stock_rows" ON "stock_rows"."product_id" = "p"."id"
    LEFT JOIN (
      SELECT "si"."product_id", SUM("si"."quantity_base") AS "sold"
      FROM "sale_items" AS "si"
      JOIN "sales_orders" AS "so" ON "so"."id" = "si"."sale_order_id"
      WHERE "si"."depot_id" = ${depotId}
        AND "so"."status" <> 'VOIDED'
        AND "so"."order_date" >= ${from}
        AND "so"."order_date" < ${to}
      GROUP BY "si"."product_id"
    ) AS "sold_rows" ON "sold_rows"."product_id" = "p"."id"
    WHERE "p"."depot_id" = ${depotId}
      AND "p"."is_active" = true
      AND COALESCE("stock_rows"."stock", 0) > 0
    ORDER BY "sold_quantity" ASC, "current_stock" DESC, "p"."name" ASC
    LIMIT 10
  `);

  return rows;
}

export async function purchasesVersusSales(
  transaction: TenantScopedTransactionClient,
  depotId: string,
  from: Date,
  to: Date,
): Promise<PurchasesVersusSalesRow[]> {
  const rows = await transaction.$queryRaw<PurchasesVersusSalesRow[]>(Prisma.sql`
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', ${from}::timestamp AT TIME ZONE ${DEPOT_TIME_ZONE}),
        date_trunc('month', ${to}::timestamp AT TIME ZONE ${DEPOT_TIME_ZONE}),
        INTERVAL '1 month'
      ) AS "month"
    ),
    sales AS (
      SELECT
        date_trunc('month', "so"."order_date" AT TIME ZONE ${DEPOT_TIME_ZONE})::date AS "month",
        SUM("so"."total") AS "total"
      FROM "sales_orders" AS "so"
      WHERE "so"."depot_id" = ${depotId}
        AND "so"."status" <> 'VOIDED'
        AND "so"."order_date" >= ${from}
        AND "so"."order_date" < ${to}
      GROUP BY 1
    ),
    purchases AS (
      SELECT
        date_trunc(
          'month',
          COALESCE("po"."ordered_at", "po"."created_at") AT TIME ZONE ${DEPOT_TIME_ZONE}
        )::date AS "month",
        SUM("po"."total") AS "total"
      FROM "purchase_orders" AS "po"
      WHERE "po"."depot_id" = ${depotId}
        AND "po"."status" = 'RECEIVED'
        AND COALESCE("po"."ordered_at", "po"."created_at") >= ${from}
        AND COALESCE("po"."ordered_at", "po"."created_at") < ${to}
      GROUP BY 1
    )
    SELECT
      to_char("months"."month", 'YYYY-MM-DD') AS "period",
      "months"."month"::date AS "period_start",
      COALESCE("purchases"."total", 0)::numeric AS "purchases",
      COALESCE("sales"."total", 0)::numeric AS "sales"
    FROM "months"
    LEFT JOIN "sales" ON "sales"."month" = "months"."month"::date
    LEFT JOIN "purchases" ON "purchases"."month" = "months"."month"::date
    ORDER BY "months"."month" ASC
  `);

  return rows;
}

export async function lowStockCount(
  transaction: TenantScopedTransactionClient,
  depotId: string,
): Promise<number> {
  const rows = await transaction.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "products" AS "p"
    LEFT JOIN (
      SELECT "product_id", SUM("quantity") AS "stock"
      FROM "stock_movements"
      WHERE "depot_id" = ${depotId}
      GROUP BY "product_id"
    ) AS "stock_rows" ON "stock_rows"."product_id" = "p"."id"
    WHERE "p"."depot_id" = ${depotId}
      AND "p"."is_active" = true
      AND COALESCE("stock_rows"."stock", 0) <= "p"."reorder_level"
  `);

  return rows[0]?.count ?? 0;
}
