import { Injectable } from '@nestjs/common';

import { toMoney } from '../../common/money/money.js';
import { Permission, roleHasPermission } from '../../common/auth/permissions.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  batchStockRows,
  creditInvoiceRows,
  lowStockCount,
  purchasesVersusSales,
  salesByCategory,
  salesByCustomer,
  salesByPeriod,
  salesByProduct,
  salesByWeekday,
  slowMovingRows,
  profitTotals,
  salesTotals,
} from '../../prisma/report-queries.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { DashboardDto } from './dto/report.dto.js';
import { buildAgeing, localDayRange, marginPercent, weekdayName } from './report-calculations.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function startOfMonth(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * The dashboard of a depot (FR-49). The owner sees every card and every chart, the sales staff only
 * the sales part, and the stock keeper the inventory part.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async build(principal: AuthenticatedPrincipal): Promise<DashboardDto> {
    const context = TenantContext.fromPrincipal(principal);
    const full = roleHasPermission(principal.role, Permission.REPORTS_FULL);
    const inventory = roleHasPermission(principal.role, Permission.REPORTS_INVENTORY);
    const sales = roleHasPermission(principal.role, Permission.REPORTS_SALES);

    const today = new Date();
    const todayRange = localDayRange(isoDay(today), isoDay(today));
    const monthRange = localDayRange(startOfMonth(today), isoDay(today));
    const trendRange = localDayRange(
      isoDay(new Date(today.getTime() - 13 * DAY_IN_MS)),
      isoDay(today),
    );
    const quarterRange = localDayRange(
      isoDay(new Date(today.getTime() - 89 * DAY_IN_MS)),
      isoDay(today),
    );
    const sixMonthRange = localDayRange(
      isoDay(new Date(today.getTime() - 181 * DAY_IN_MS)),
      isoDay(today),
    );

    return this.prisma.runAsTenant(context, async (transaction) => {
      const depotId = context.depotId;

      const [
        todayTotals,
        monthTotals,
        monthProfit,
        trend,
        products,
        categories,
        customers,
        creditInvoices,
        weekday,
        purchases,
        slowMoving,
        batches,
        lowStock,
      ] = await Promise.all([
        salesTotals(transaction, depotId, todayRange.start, todayRange.end),
        salesTotals(transaction, depotId, monthRange.start, monthRange.end),
        profitTotals(transaction, depotId, monthRange.start, monthRange.end),
        salesByPeriod(transaction, depotId, 'day', trendRange.start, trendRange.end),
        salesByProduct(transaction, depotId, quarterRange.start, quarterRange.end),
        salesByCategory(transaction, depotId, quarterRange.start, quarterRange.end),
        salesByCustomer(transaction, depotId, quarterRange.start, quarterRange.end),
        creditInvoiceRows(transaction, depotId),
        salesByWeekday(transaction, depotId, quarterRange.start, quarterRange.end),
        purchasesVersusSales(transaction, depotId, sixMonthRange.start, sixMonthRange.end),
        slowMovingRows(transaction, depotId, quarterRange.start, quarterRange.end),
        batchStockRows(transaction, depotId, new Date(today.getTime() + 30 * DAY_IN_MS)),
        lowStockCount(transaction, depotId),
      ]);

      const ageing = buildAgeing(
        creditInvoices.map((invoice) => ({
          dueDate: invoice.due_date,
          outstanding: invoice.outstanding,
        })),
        today,
      );
      const outstanding = creditInvoices
        .map((invoice) => invoice.outstanding)
        .reduce((total, value) => total.plus(new Prisma.Decimal(value)), new Prisma.Decimal(0));

      const dashboard: DashboardDto = {
        kpis: {
          todaySales: toMoney(todayTotals.total).toFixed(2),
          monthSales: toMoney(monthTotals.total).toFixed(2),
          monthInvoiceCount: monthTotals.invoiceCount,
          totalOutstandingCredit: toMoney(outstanding).toFixed(2),
          overdueAmount: ageing.overdueTotal,
          monthGrossProfit: toMoney(monthProfit.profit).toFixed(2),
          monthMarginPercent: marginPercent(monthProfit.revenue, monthProfit.profit),
          lowStockCount: lowStock,
          nearExpiryCount: batches.filter(
            (batch) =>
              new Prisma.Decimal(batch.stock).gt(0) &&
              batch.expiry_date !== null &&
              batch.expiry_date >= today,
          ).length,
        },
        charts: {
          salesTrend: [],
          topProductsByRevenue: [],
          topProductsByQuantity: [],
          salesByCategory: [],
          topCustomersBySales: [],
          topCustomersByBalance: [],
          creditAgeing: ageing.buckets,
          salesByWeekday: [],
          slowMovingStock: [],
          purchasesVersusSales: [],
        },
      };

      if (sales) {
        dashboard.charts.salesTrend = trend.map((row) => ({
          period: row.period,
          total: toMoney(row.total).toFixed(2),
          invoiceCount: row.invoice_count,
        }));
        dashboard.charts.salesByWeekday = weekday.map((row) => ({
          name: weekdayName(row.weekday),
          weekday: row.weekday,
          total: toMoney(row.total).toFixed(2),
          invoiceCount: row.invoice_count,
        }));
        dashboard.charts.purchasesVersusSales = purchases.map((row) => ({
          period: row.period,
          purchases: toMoney(row.purchases).toFixed(2),
          sales: toMoney(row.sales).toFixed(2),
        }));
      }

      if (full) {
        dashboard.charts.topProductsByRevenue = products.slice(0, 10).map((row) => ({
          productId: row.product_id,
          name: row.name,
          sku: row.sku,
          revenue: toMoney(row.revenue).toFixed(2),
          quantityBase: row.quantity_base,
        }));
        dashboard.charts.topProductsByQuantity = [...products]
          .sort((left, right) =>
            new Prisma.Decimal(right.quantity_base).comparedTo(
              new Prisma.Decimal(left.quantity_base),
            ),
          )
          .slice(0, 10)
          .map((row) => ({
            productId: row.product_id,
            name: row.name,
            sku: row.sku,
            revenue: toMoney(row.revenue).toFixed(2),
            quantityBase: row.quantity_base,
          }));
        dashboard.charts.salesByCategory = categories.map((row) => ({
          categoryId: row.group_id === 'uncategorised' ? null : row.group_id,
          name: row.name,
          total: toMoney(row.total).toFixed(2),
        }));
        dashboard.charts.topCustomersBySales = customers.slice(0, 10).map((row) => ({
          customerId: row.group_id,
          name: row.name,
          total: toMoney(row.total).toFixed(2),
          balance: toMoney(row.outstanding).toFixed(2),
        }));
        dashboard.charts.topCustomersByBalance = [...customers]
          .sort((left, right) =>
            new Prisma.Decimal(right.outstanding).comparedTo(new Prisma.Decimal(left.outstanding)),
          )
          .slice(0, 10)
          .map((row) => ({
            customerId: row.group_id,
            name: row.name,
            total: toMoney(row.total).toFixed(2),
            balance: toMoney(row.outstanding).toFixed(2),
          }));
      }

      if (inventory) {
        dashboard.charts.slowMovingStock = slowMoving.map((row) => ({
          productId: row.product_id,
          name: row.name,
          sku: row.sku,
          currentStock: row.current_stock,
          soldQuantity: row.sold_quantity,
        }));
      }

      return dashboard;
    });
  }
}
