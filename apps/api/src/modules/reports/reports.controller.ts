import { Controller, Get, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Permission } from '../../common/auth/permissions.js';
import { RequirePermissions } from '../../common/auth/require-permissions.decorator.js';
import { SWAGGER_SECURITY_SCHEME } from '../../common/bootstrap/configure-swagger.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import {
  InventoryReportQueryDto,
  ReportRangeQueryDto,
  SalesReportQueryDto,
} from './dto/report-query.dto.js';
import {
  CreditReportDto,
  InventoryReportDto,
  ProfitReportDto,
  PurchaseReportDto,
  SalesGroupRowDto,
  SalesProductRowDto,
  SalesReportDto,
} from './dto/report.dto.js';
import { ReportsService } from './reports.service.js';

/** The part of the Express response the CSV export needs. */
interface CsvResponse {
  setHeader(name: string, value: string): void;
}

/**
 * The report endpoints. The owner sees every report, the sales staff only the basic sales
 * summary, and the stock keeper the inventory and the purchase reports.
 */
@ApiTags('reports')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @RequirePermissions(Permission.REPORTS_SALES)
  @Get('sales')
  @ApiOperation({
    summary: 'Sales over time',
    description:
      'The days, weeks, or months of the range in the time of Phnom Penh. Voided invoices are not counted. The sales staff only see the totals and the trend.',
  })
  @ApiOkResponse({ type: SalesReportDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read the sales report.' })
  async sales(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: SalesReportQueryDto,
    @Res({ passthrough: true }) response: CsvResponse,
  ) {
    const payload = await this.reports.salesByPeriod(principal, query);

    if (query.format === 'csv') {
      response.setHeader('content-type', 'text/csv; charset=utf-8');
      response.setHeader('content-disposition', 'attachment; filename="sales.csv"');
      return payload.csv;
    }

    if (!this.reports.hasFullReports(principal)) {
      return {
        ...payload.data,
        rows: payload.data.rows.map((row) => ({
          period: row.period,
          periodStart: row.periodStart,
          invoiceCount: row.invoiceCount,
          total: row.total,
        })),
      };
    }

    return payload.data;
  }

  @RequirePermissions(Permission.REPORTS_FULL)
  @Get('sales/by-product')
  @ApiOperation({ summary: 'Sales by product' })
  @ApiOkResponse({ type: [SalesProductRowDto] })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'Only the depot owner sees this report.' })
  async salesByProduct(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: ReportRangeQueryDto,
    @Res({ passthrough: true }) response: CsvResponse,
  ) {
    const payload = await this.reports.salesByProduct(principal, query);

    if (query.format === 'csv') {
      response.setHeader('content-type', 'text/csv; charset=utf-8');
      response.setHeader('content-disposition', 'attachment; filename="sales-by-product.csv"');
      return payload.csv;
    }

    return payload.data;
  }

  @RequirePermissions(Permission.REPORTS_FULL)
  @Get('sales/by-category')
  @ApiOperation({ summary: 'Sales by category' })
  @ApiOkResponse({ type: [SalesGroupRowDto] })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'Only the depot owner sees this report.' })
  async salesByCategory(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: ReportRangeQueryDto,
    @Res({ passthrough: true }) response: CsvResponse,
  ) {
    const payload = await this.reports.salesByCategory(principal, query);

    if (query.format === 'csv') {
      response.setHeader('content-type', 'text/csv; charset=utf-8');
      response.setHeader('content-disposition', 'attachment; filename="sales-by-category.csv"');
      return payload.csv;
    }

    return payload.data;
  }

  @RequirePermissions(Permission.REPORTS_FULL)
  @Get('sales/by-customer')
  @ApiOperation({ summary: 'Sales by customer' })
  @ApiOkResponse({ type: [SalesGroupRowDto] })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'Only the depot owner sees this report.' })
  async salesByCustomer(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: ReportRangeQueryDto,
    @Res({ passthrough: true }) response: CsvResponse,
  ) {
    const payload = await this.reports.salesByCustomer(principal, query);

    if (query.format === 'csv') {
      response.setHeader('content-type', 'text/csv; charset=utf-8');
      response.setHeader('content-disposition', 'attachment; filename="sales-by-customer.csv"');
      return payload.csv;
    }

    return payload.data;
  }

  @RequirePermissions(Permission.REPORTS_FULL)
  @Get('sales/by-staff')
  @ApiOperation({ summary: 'Sales by staff member' })
  @ApiOkResponse({ type: [SalesGroupRowDto] })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'Only the depot owner sees this report.' })
  async salesByStaff(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: ReportRangeQueryDto,
    @Res({ passthrough: true }) response: CsvResponse,
  ) {
    const payload = await this.reports.salesByStaff(principal, query);

    if (query.format === 'csv') {
      response.setHeader('content-type', 'text/csv; charset=utf-8');
      response.setHeader('content-disposition', 'attachment; filename="sales-by-staff.csv"');
      return payload.csv;
    }

    return payload.data;
  }

  @RequirePermissions(Permission.REPORTS_INVENTORY)
  @Get('inventory')
  @ApiOperation({
    summary: 'Inventory report',
    description:
      'The current stock, the low stock products, the batches that expire soon, and the value of the stock with the cost per base unit.',
  })
  @ApiOkResponse({ type: InventoryReportDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read the inventory report.' })
  async inventory(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: InventoryReportQueryDto,
    @Res({ passthrough: true }) response: CsvResponse,
  ) {
    const payload = await this.reports.inventory(principal, query);

    if (query.format === 'csv') {
      response.setHeader('content-type', 'text/csv; charset=utf-8');
      response.setHeader('content-disposition', 'attachment; filename="inventory.csv"');
      return payload.csv;
    }

    return payload.data;
  }

  @RequirePermissions(Permission.REPORTS_FULL)
  @Get('credit')
  @ApiOperation({
    summary: 'Credit report',
    description:
      'The outstanding balance of every customer with the ageing buckets 0-30, 31-60, and over 60 days.',
  })
  @ApiOkResponse({ type: CreditReportDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'Only the depot owner sees this report.' })
  async credit(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: ReportRangeQueryDto,
    @Res({ passthrough: true }) response: CsvResponse,
  ) {
    const payload = await this.reports.credit(principal);

    if (query.format === 'csv') {
      response.setHeader('content-type', 'text/csv; charset=utf-8');
      response.setHeader('content-disposition', 'attachment; filename="credit.csv"');
      return payload.csv;
    }

    return payload.data;
  }

  @RequirePermissions(Permission.REPORTS_FULL)
  @Get('profit')
  @ApiOperation({
    summary: 'Profit report',
    description:
      'The revenue, the cost of goods sold from the cost that was stored on every sale line, the gross profit, and the margin.',
  })
  @ApiOkResponse({ type: ProfitReportDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'Only the depot owner sees this report.' })
  async profit(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: ReportRangeQueryDto,
    @Res({ passthrough: true }) response: CsvResponse,
  ) {
    const payload = await this.reports.profit(principal, query);

    if (query.format === 'csv') {
      response.setHeader('content-type', 'text/csv; charset=utf-8');
      response.setHeader('content-disposition', 'attachment; filename="profit.csv"');
      return payload.csv;
    }

    return payload.data;
  }

  @RequirePermissions(Permission.REPORTS_PURCHASES)
  @Get('purchases')
  @ApiOperation({ summary: 'Purchases by supplier and period' })
  @ApiOkResponse({ type: PurchaseReportDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read the purchase report.' })
  async purchases(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: ReportRangeQueryDto,
    @Res({ passthrough: true }) response: CsvResponse,
  ) {
    const payload = await this.reports.purchases(principal, query);

    if (query.format === 'csv') {
      response.setHeader('content-type', 'text/csv; charset=utf-8');
      response.setHeader('content-disposition', 'attachment; filename="purchases.csv"');
      return payload.csv;
    }

    return payload.data;
  }
}
