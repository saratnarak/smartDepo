import { Injectable } from '@nestjs/common';

import { sumMoney, toMoney } from '../../common/money/money.js';
import { Permission, roleHasPermission } from '../../common/auth/permissions.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import { formatBaseQuantity } from '../../common/units/quantity.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  batchStockRows,
  creditInvoiceRows,
  creditRows,
  inventoryRows,
  purchasesBySupplier,
  salesByCustomer,
  salesByCategory,
  salesByPeriod,
  salesByProduct,
  salesByStaff,
  salesTotals,
  profitTotals,
  DEPOT_TIME_ZONE,
} from '../../prisma/report-queries.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  InventoryReportQueryDto,
  ReportRangeQueryDto,
  SalesReportQueryDto,
} from './dto/report-query.dto.js';
import type {
  CreditReportDto,
  InventoryReportDto,
  ProfitReportDto,
  PurchaseReportDto,
  SalesGroupRowDto,
  SalesProductRowDto,
  SalesReportDto,
} from './dto/report.dto.js';
import {
  buildAgeing,
  localDayRange,
  marginPercent,
  toCsv,
  type SalesPeriodUnit,
} from './report-calculations.js';

export interface ReportPayload<T> {
  data: T;
  csv: string;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_IN_MS);
}

function defaultRange(days: number): { from: string; to: string } {
  const today = new Date();
  const to = isoDay(today);
  const from = isoDay(addDays(today, -days + 1));

  return { from, to };
}

/**
 * The depot reports (FR-42 to FR-48). Every query runs inside the tenant transaction of the
 * caller, so the depot id comes from the access token and the row-level security policies are a
 * second layer. The reports never read a table without the depot id.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private range(query: ReportRangeQueryDto, fallbackDays: number) {
    const fallback = defaultRange(fallbackDays);
    const from = query.from ?? fallback.from;
    const to = query.to ?? fallback.to;
    const { start, end } = localDayRange(from, to);

    return { from, to, start, end };
  }

  async salesByPeriod(
    principal: AuthenticatedPrincipal,
    query: SalesReportQueryDto,
  ): Promise<ReportPayload<SalesReportDto>> {
    const context = TenantContext.fromPrincipal(principal);
    const { from, to, start, end } = this.range(query, 30);
    const unit: SalesPeriodUnit = query.unit === 'custom' ? 'day' : query.unit;

    return this.prisma.runAsTenant(context, async (transaction) => {
      const rows = await salesByPeriod(transaction, context.depotId, unit, start, end);
      const totals = await salesTotals(transaction, context.depotId, start, end);

      const data: SalesReportDto = {
        from,
        to,
        unit: query.unit,
        timeZone: DEPOT_TIME_ZONE,
        totals: {
          invoiceCount: totals.invoiceCount,
          subtotal: toMoney(totals.subtotal).toFixed(2),
          discountTotal: toMoney(totals.discountTotal ?? '0').toFixed(2),
          total: toMoney(totals.total).toFixed(2),
          paid: toMoney(totals.paid).toFixed(2),
          outstanding: toMoney(totals.outstanding).toFixed(2),
        },
        rows: rows.map((row) => ({
          period: row.period,
          periodStart: row.period_start,
          invoiceCount: row.invoice_count,
          subtotal: toMoney(row.subtotal).toFixed(2),
          discountTotal: toMoney(row.discount_total).toFixed(2),
          total: toMoney(row.total).toFixed(2),
          paid: toMoney(row.paid).toFixed(2),
          outstanding: toMoney(row.outstanding).toFixed(2),
        })),
      };

      return {
        data,
        csv: toCsv(
          [
            { key: 'period', header: 'Period' },
            { key: 'invoiceCount', header: 'Invoices' },
            { key: 'subtotal', header: 'Subtotal' },
            { key: 'discountTotal', header: 'Discount' },
            { key: 'total', header: 'Total' },
            { key: 'paid', header: 'Paid' },
            { key: 'outstanding', header: 'Outstanding' },
          ],
          data.rows.map((row) => ({ ...row, periodStart: undefined })),
        ),
      };
    });
  }

  async salesByProduct(
    principal: AuthenticatedPrincipal,
    query: ReportRangeQueryDto,
  ): Promise<ReportPayload<SalesProductRowDto[]>> {
    const context = TenantContext.fromPrincipal(principal);
    const { start, end } = this.range(query, 90);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const rows = await salesByProduct(transaction, context.depotId, start, end);
      const data = rows.map((row) => ({
        productId: row.product_id,
        sku: row.sku,
        name: row.name,
        category: row.category_name,
        quantityBase: row.quantity_base,
        revenue: toMoney(row.revenue).toFixed(2),
        cost: toMoney(row.cost).toFixed(2),
        profit: toMoney(row.profit).toFixed(2),
        marginPercent: marginPercent(row.revenue, row.profit),
      }));

      return {
        data,
        csv: toCsv(
          [
            { key: 'sku', header: 'SKU' },
            { key: 'name', header: 'Product' },
            { key: 'category', header: 'Category' },
            { key: 'quantityBase', header: 'Quantity (base)' },
            { key: 'revenue', header: 'Revenue' },
            { key: 'cost', header: 'Cost' },
            { key: 'profit', header: 'Profit' },
            { key: 'marginPercent', header: 'Margin %' },
          ],
          data,
        ),
      };
    });
  }

  async salesByCategory(
    principal: AuthenticatedPrincipal,
    query: ReportRangeQueryDto,
  ): Promise<ReportPayload<SalesGroupRowDto[]>> {
    const context = TenantContext.fromPrincipal(principal);
    const { start, end } = this.range(query, 90);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const rows = await salesByCategory(transaction, context.depotId, start, end);
      const data = rows.map((row) => ({
        groupId: row.group_id,
        name: row.name,
        detail: null,
        invoiceCount: row.invoice_count,
        subtotal: toMoney(row.subtotal).toFixed(2),
        discountTotal: toMoney(row.discount_total).toFixed(2),
        total: toMoney(row.total).toFixed(2),
        paid: toMoney(row.paid).toFixed(2),
        outstanding: toMoney(row.outstanding).toFixed(2),
      }));

      return {
        data,
        csv: toCsv(
          [
            { key: 'name', header: 'Category' },
            { key: 'invoiceCount', header: 'Invoices' },
            { key: 'subtotal', header: 'Subtotal' },
            { key: 'discountTotal', header: 'Discount' },
            { key: 'total', header: 'Total' },
            { key: 'paid', header: 'Paid' },
            { key: 'outstanding', header: 'Outstanding' },
          ],
          data,
        ),
      };
    });
  }

  async salesByCustomer(
    principal: AuthenticatedPrincipal,
    query: ReportRangeQueryDto,
  ): Promise<ReportPayload<SalesGroupRowDto[]>> {
    const context = TenantContext.fromPrincipal(principal);
    const { start, end } = this.range(query, 90);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const rows = await salesByCustomer(transaction, context.depotId, start, end);
      const data = rows.map((row) => ({
        groupId: row.group_id,
        name: row.name,
        detail: row.detail,
        invoiceCount: row.invoice_count,
        subtotal: toMoney(row.subtotal).toFixed(2),
        discountTotal: toMoney(row.discount_total).toFixed(2),
        total: toMoney(row.total).toFixed(2),
        paid: toMoney(row.paid).toFixed(2),
        outstanding: toMoney(row.outstanding).toFixed(2),
      }));

      return {
        data,
        csv: toCsv(
          [
            { key: 'name', header: 'Customer' },
            { key: 'detail', header: 'Type' },
            { key: 'invoiceCount', header: 'Invoices' },
            { key: 'subtotal', header: 'Subtotal' },
            { key: 'discountTotal', header: 'Discount' },
            { key: 'total', header: 'Total' },
            { key: 'paid', header: 'Paid' },
            { key: 'outstanding', header: 'Outstanding' },
          ],
          data,
        ),
      };
    });
  }

  async salesByStaff(
    principal: AuthenticatedPrincipal,
    query: ReportRangeQueryDto,
  ): Promise<ReportPayload<SalesGroupRowDto[]>> {
    const context = TenantContext.fromPrincipal(principal);
    const { start, end } = this.range(query, 90);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const rows = await salesByStaff(transaction, context.depotId, start, end);
      const data = rows.map((row) => ({
        groupId: row.group_id,
        name: row.name,
        detail: row.detail,
        invoiceCount: row.invoice_count,
        subtotal: toMoney(row.subtotal).toFixed(2),
        discountTotal: toMoney(row.discount_total).toFixed(2),
        total: toMoney(row.total).toFixed(2),
        paid: toMoney(row.paid).toFixed(2),
        outstanding: toMoney(row.outstanding).toFixed(2),
      }));

      return {
        data,
        csv: toCsv(
          [
            { key: 'name', header: 'Staff' },
            { key: 'detail', header: 'Role' },
            { key: 'invoiceCount', header: 'Invoices' },
            { key: 'subtotal', header: 'Subtotal' },
            { key: 'discountTotal', header: 'Discount' },
            { key: 'total', header: 'Total' },
            { key: 'paid', header: 'Paid' },
            { key: 'outstanding', header: 'Outstanding' },
          ],
          data,
        ),
      };
    });
  }

  async inventory(
    principal: AuthenticatedPrincipal,
    query: InventoryReportQueryDto,
  ): Promise<ReportPayload<InventoryReportDto>> {
    const context = TenantContext.fromPrincipal(principal);
    const today = new Date();
    const expiryBefore = addDays(today, query.expiryDays);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const [rows, batches, products] = await Promise.all([
        inventoryRows(transaction, context.depotId),
        batchStockRows(transaction, context.depotId, expiryBefore),
        transaction.product.findMany({
          where: {},
          select: {
            id: true,
            productUnits: {
              select: {
                name: true,
                conversionFactor: true,
                isBaseUnit: true,
                isActive: true,
              },
            },
          },
        }),
      ]);
      const unitsByProduct = new Map(
        products.map((product) => [
          product.id,
          product.productUnits.map((unit) => ({
            name: unit.name,
            conversionFactor: unit.conversionFactor,
            isBaseUnit: unit.isBaseUnit,
            isActive: unit.isActive,
          })),
        ]),
      );
      const batchesByProduct = new Map<string, typeof batches>();

      for (const batch of batches) {
        const list = batchesByProduct.get(batch.product_id) ?? [];
        list.push(batch);
        batchesByProduct.set(batch.product_id, list);
      }

      const data: InventoryReportDto = {
        productCount: rows.length,
        lowStockCount: rows.filter(
          (row) =>
            row.is_active &&
            new Prisma.Decimal(row.current_stock).lte(new Prisma.Decimal(row.reorder_level)),
        ).length,
        nearExpiryBatchCount: batches.filter(
          (batch) =>
            new Prisma.Decimal(batch.stock).gt(0) &&
            batch.expiry_date !== null &&
            batch.expiry_date >= today,
        ).length,
        totalStockValue: '0.00',
        rows: [],
      };

      const values: string[] = [];

      for (const row of rows) {
        const units = unitsByProduct.get(row.product_id) ?? [];
        const stock = new Prisma.Decimal(row.current_stock);
        const value = stock.times(new Prisma.Decimal(row.cost_price));
        values.push(value.toFixed(2));

        data.rows.push({
          productId: row.product_id,
          sku: row.sku,
          name: row.name,
          category: row.category_name,
          isActive: row.is_active,
          trackBatches: row.track_batches,
          currentStock: row.current_stock,
          currentStockReadable: formatBaseQuantity(row.current_stock, units),
          reorderLevel: row.reorder_level,
          lowStock: row.is_active && stock.lte(new Prisma.Decimal(row.reorder_level)),
          costPerBaseUnit: row.cost_price,
          stockValue: value.toFixed(2),
          batches: (batchesByProduct.get(row.product_id) ?? []).map((batch) => ({
            batchId: batch.batch_id,
            batchNumber: batch.batch_number,
            expiryDate: batch.expiry_date,
            stock: batch.stock,
            expired: batch.expiry_date !== null && batch.expiry_date < today,
          })),
        });
      }

      data.totalStockValue = sumMoney(values).toFixed(2);

      return {
        data,
        csv: toCsv(
          [
            { key: 'sku', header: 'SKU' },
            { key: 'name', header: 'Product' },
            { key: 'category', header: 'Category' },
            { key: 'currentStock', header: 'Stock (base)' },
            { key: 'currentStockReadable', header: 'Stock' },
            { key: 'reorderLevel', header: 'Reorder level' },
            { key: 'lowStock', header: 'Low stock' },
            { key: 'costPerBaseUnit', header: 'Cost per base unit' },
            { key: 'stockValue', header: 'Stock value' },
          ],
          data.rows,
        ),
      };
    });
  }

  async credit(principal: AuthenticatedPrincipal): Promise<ReportPayload<CreditReportDto>> {
    const context = TenantContext.fromPrincipal(principal);
    const today = new Date();

    return this.prisma.runAsTenant(context, async (transaction) => {
      const [rows, invoices] = await Promise.all([
        creditRows(transaction, context.depotId),
        creditInvoiceRows(transaction, context.depotId),
      ]);
      const invoicesByCustomer = new Map<string, typeof invoices>();

      for (const invoice of invoices) {
        const list = invoicesByCustomer.get(invoice.customer_id) ?? [];
        list.push(invoice);
        invoicesByCustomer.set(invoice.customer_id, list);
      }

      const data: CreditReportDto = {
        totalOutstanding: '0.00',
        totalOverdue: '0.00',
        rows: [],
      };
      const outstandingValues: string[] = [];
      const overdueValues: string[] = [];

      for (const row of rows) {
        const ageing = buildAgeing(
          (invoicesByCustomer.get(row.customer_id) ?? []).map((invoice) => ({
            dueDate: invoice.due_date,
            outstanding: invoice.outstanding,
          })),
          today,
        );
        outstandingValues.push(row.outstanding);
        overdueValues.push(ageing.overdueTotal);

        data.rows.push({
          customerId: row.customer_id,
          name: row.name,
          type: row.type,
          creditLimit: row.credit_limit,
          paymentTermDays: row.payment_term_days,
          invoiced: toMoney(row.total_invoiced).toFixed(2),
          paid: toMoney(row.paid).toFixed(2),
          outstanding: toMoney(row.outstanding).toFixed(2),
          overdue: ageing.overdueTotal,
          ageing: ageing.buckets,
        });
      }

      data.totalOutstanding = sumMoney(outstandingValues).toFixed(2);
      data.totalOverdue = sumMoney(overdueValues).toFixed(2);

      return {
        data,
        csv: toCsv(
          [
            { key: 'name', header: 'Customer' },
            { key: 'type', header: 'Type' },
            { key: 'creditLimit', header: 'Credit limit' },
            { key: 'paymentTermDays', header: 'Payment terms (days)' },
            { key: 'invoiced', header: 'Invoiced' },
            { key: 'paid', header: 'Paid' },
            { key: 'outstanding', header: 'Outstanding' },
            { key: 'overdue', header: 'Overdue' },
            { key: '0-30', header: 'Ageing 0-30' },
            { key: '31-60', header: 'Ageing 31-60' },
            { key: 'OVER_60', header: 'Ageing over 60' },
          ],
          data.rows.map((row) => ({
            ...row,
            '0-30': row.ageing['0-30'],
            '31-60': row.ageing['31-60'],
            OVER_60: row.ageing.OVER_60,
          })),
        ),
      };
    });
  }

  async profit(
    principal: AuthenticatedPrincipal,
    query: ReportRangeQueryDto,
  ): Promise<ReportPayload<ProfitReportDto>> {
    const context = TenantContext.fromPrincipal(principal);
    const { start, end } = this.range(query, 90);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const [totals, rows] = await Promise.all([
        profitTotals(transaction, context.depotId, start, end),
        salesByProduct(transaction, context.depotId, start, end),
      ]);

      const data: ProfitReportDto = {
        revenue: toMoney(totals.revenue).toFixed(2),
        cost: toMoney(totals.cost).toFixed(2),
        profit: toMoney(totals.profit).toFixed(2),
        marginPercent: marginPercent(totals.revenue, totals.profit),
        rows: rows.map((row) => ({
          productId: row.product_id,
          sku: row.sku,
          name: row.name,
          category: row.category_name,
          quantityBase: row.quantity_base,
          revenue: toMoney(row.revenue).toFixed(2),
          cost: toMoney(row.cost).toFixed(2),
          profit: toMoney(row.profit).toFixed(2),
          marginPercent: marginPercent(row.revenue, row.profit),
        })),
      };

      return {
        data,
        csv: toCsv(
          [
            { key: 'sku', header: 'SKU' },
            { key: 'name', header: 'Product' },
            { key: 'category', header: 'Category' },
            { key: 'quantityBase', header: 'Quantity (base)' },
            { key: 'revenue', header: 'Revenue' },
            { key: 'cost', header: 'Cost of goods sold' },
            { key: 'profit', header: 'Gross profit' },
            { key: 'marginPercent', header: 'Margin %' },
          ],
          data.rows,
        ),
      };
    });
  }

  async purchases(
    principal: AuthenticatedPrincipal,
    query: ReportRangeQueryDto,
  ): Promise<ReportPayload<PurchaseReportDto>> {
    const context = TenantContext.fromPrincipal(principal);
    const { start, end } = this.range(query, 90);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const rows = await purchasesBySupplier(transaction, context.depotId, start, end);
      const data: PurchaseReportDto = {
        totalPurchases: sumMoney(rows.map((row) => row.total)).toFixed(2),
        rows: rows.map((row) => ({
          supplierId: row.supplier_id,
          name: row.name,
          period: row.period,
          purchaseCount: row.purchase_count,
          subtotal: toMoney(row.subtotal).toFixed(2),
          total: toMoney(row.total).toFixed(2),
        })),
      };

      return {
        data,
        csv: toCsv(
          [
            { key: 'name', header: 'Supplier' },
            { key: 'period', header: 'Period' },
            { key: 'purchaseCount', header: 'Purchases' },
            { key: 'subtotal', header: 'Subtotal' },
            { key: 'total', header: 'Total' },
          ],
          data.rows,
        ),
      };
    });
  }

  /** True when the caller may see the reports that only the owner gets. */
  hasFullReports(principal: AuthenticatedPrincipal): boolean {
    return roleHasPermission(principal.role, Permission.REPORTS_FULL);
  }
}
