import { ApiProperty } from '@nestjs/swagger';

export class SalesPeriodRowDto {
  @ApiProperty({ example: '2026-10-21' })
  period!: string;

  @ApiProperty({ format: 'date-time' })
  periodStart!: Date;

  @ApiProperty({ example: 4 })
  invoiceCount!: number;

  @ApiProperty({ example: '1200.00' })
  subtotal!: string;

  @ApiProperty({ example: '50.00' })
  discountTotal!: string;

  @ApiProperty({ example: '1150.00' })
  total!: string;

  @ApiProperty({ example: '900.00' })
  paid!: string;

  @ApiProperty({ example: '250.00' })
  outstanding!: string;
}

export class SalesTotalsDto {
  @ApiProperty({ example: 32 })
  invoiceCount!: number;

  @ApiProperty({ example: '12000.00' })
  subtotal!: string;

  @ApiProperty({ example: '500.00' })
  discountTotal!: string;

  @ApiProperty({ example: '11500.00' })
  total!: string;

  @ApiProperty({ example: '9000.00' })
  paid!: string;

  @ApiProperty({ example: '2500.00' })
  outstanding!: string;
}

export class SalesReportDto {
  @ApiProperty({ example: '2026-10-01' })
  from!: string;

  @ApiProperty({ example: '2026-10-31' })
  to!: string;

  @ApiProperty({ example: 'day' })
  unit!: string;

  @ApiProperty({ example: 'Asia/Phnom_Penh' })
  timeZone!: string;

  @ApiProperty({ type: () => SalesTotalsDto })
  totals!: SalesTotalsDto;

  @ApiProperty({ type: [SalesPeriodRowDto] })
  rows!: SalesPeriodRowDto[];
}

export class SalesProductRowDto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ example: 'BEER-001' })
  sku!: string;

  @ApiProperty({ example: 'ABC Beer 330ml' })
  name!: string;

  @ApiProperty({ nullable: true, example: 'Beer' })
  category!: string | null;

  @ApiProperty({ example: '288' })
  quantityBase!: string;

  @ApiProperty({ example: '576.00' })
  revenue!: string;

  @ApiProperty({ example: '288.00' })
  cost!: string;

  @ApiProperty({ example: '288.00' })
  profit!: string;

  @ApiProperty({ nullable: true, example: '50.00' })
  marginPercent!: string | null;
}

export class SalesGroupRowDto {
  @ApiProperty({ format: 'uuid' })
  groupId!: string;

  @ApiProperty({ example: 'Sokha Restaurant' })
  name!: string;

  @ApiProperty({ nullable: true, example: 'WHOLESALE' })
  detail!: string | null;

  @ApiProperty({ example: 6 })
  invoiceCount!: number;

  @ApiProperty({ example: '600.00' })
  subtotal!: string;

  @ApiProperty({ example: '0.00' })
  discountTotal!: string;

  @ApiProperty({ example: '600.00' })
  total!: string;

  @ApiProperty({ example: '300.00' })
  paid!: string;

  @ApiProperty({ example: '300.00' })
  outstanding!: string;
}

export class InventoryBatchDto {
  @ApiProperty({ format: 'uuid' })
  batchId!: string;

  @ApiProperty({ example: 'LOT-2026-01' })
  batchNumber!: string;

  @ApiProperty({ format: 'date', nullable: true })
  expiryDate!: Date | null;

  @ApiProperty({ example: '288' })
  stock!: string;

  @ApiProperty({ example: true })
  expired!: boolean;
}

export class InventoryRowDto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ example: 'BEER-001' })
  sku!: string;

  @ApiProperty({ example: 'ABC Beer 330ml' })
  name!: string;

  @ApiProperty({ nullable: true, example: 'Beer' })
  category!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: true })
  trackBatches!: boolean;

  @ApiProperty({ example: '288' })
  currentStock!: string;

  @ApiProperty({ example: '12 cartons' })
  currentStockReadable!: string;

  @ApiProperty({ example: '120' })
  reorderLevel!: string;

  @ApiProperty({ example: true })
  lowStock!: boolean;

  @ApiProperty({ example: '1.0000' })
  costPerBaseUnit!: string;

  @ApiProperty({ example: '288.00' })
  stockValue!: string;

  @ApiProperty({ type: [InventoryBatchDto] })
  batches!: InventoryBatchDto[];
}

export class InventoryReportDto {
  @ApiProperty({ example: 3 })
  productCount!: number;

  @ApiProperty({ example: 1 })
  lowStockCount!: number;

  @ApiProperty({ example: 2 })
  nearExpiryBatchCount!: number;

  @ApiProperty({ example: '576.00' })
  totalStockValue!: string;

  @ApiProperty({ type: [InventoryRowDto] })
  rows!: InventoryRowDto[];
}

export class AgeingBucketsDto {
  @ApiProperty({ example: '100.00' })
  '0-30'!: string;

  @ApiProperty({ example: '250.00' })
  '31-60'!: string;

  @ApiProperty({ example: '75.00' })
  OVER_60!: string;
}

export class CreditRowDto {
  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ example: 'Sokha Restaurant' })
  name!: string;

  @ApiProperty({ example: 'WHOLESALE' })
  type!: string;

  @ApiProperty({ nullable: true, example: '500.00' })
  creditLimit!: string | null;

  @ApiProperty({ nullable: true, example: 30 })
  paymentTermDays!: number | null;

  @ApiProperty({ example: '600.00' })
  invoiced!: string;

  @ApiProperty({ example: '300.00' })
  paid!: string;

  @ApiProperty({ example: '300.00' })
  outstanding!: string;

  @ApiProperty({ example: '150.00' })
  overdue!: string;

  @ApiProperty({ type: () => AgeingBucketsDto })
  ageing!: AgeingBucketsDto;
}

export class CreditReportDto {
  @ApiProperty({ example: '425.00' })
  totalOutstanding!: string;

  @ApiProperty({ example: '150.00' })
  totalOverdue!: string;

  @ApiProperty({ type: [CreditRowDto] })
  rows!: CreditRowDto[];
}

export class ProfitReportDto {
  @ApiProperty({ example: '12000.00' })
  revenue!: string;

  @ApiProperty({ example: '8400.00' })
  cost!: string;

  @ApiProperty({ example: '3600.00' })
  profit!: string;

  @ApiProperty({ nullable: true, example: '30.00' })
  marginPercent!: string | null;

  @ApiProperty({ type: [SalesProductRowDto] })
  rows!: SalesProductRowDto[];
}

export class PurchaseReportRowDto {
  @ApiProperty({ format: 'uuid' })
  supplierId!: string;

  @ApiProperty({ example: 'Phnom Penh Beverages' })
  name!: string;

  @ApiProperty({ example: '2026-10-01' })
  period!: string;

  @ApiProperty({ example: 3 })
  purchaseCount!: number;

  @ApiProperty({ example: '900.00' })
  subtotal!: string;

  @ApiProperty({ example: '900.00' })
  total!: string;
}

export class PurchaseReportDto {
  @ApiProperty({ example: '4500.00' })
  totalPurchases!: string;

  @ApiProperty({ type: [PurchaseReportRowDto] })
  rows!: PurchaseReportRowDto[];
}

export class DashboardKpiDto {
  @ApiProperty({ example: '150.00' })
  todaySales!: string;

  @ApiProperty({ example: '4200.00' })
  monthSales!: string;

  @ApiProperty({ example: 18 })
  monthInvoiceCount!: number;

  @ApiProperty({ example: '1250.00' })
  totalOutstandingCredit!: string;

  @ApiProperty({ example: '430.00' })
  overdueAmount!: string;

  @ApiProperty({ example: '1260.00' })
  monthGrossProfit!: string;

  @ApiProperty({ nullable: true, example: '30.00' })
  monthMarginPercent!: string | null;

  @ApiProperty({ example: 3 })
  lowStockCount!: number;

  @ApiProperty({ example: 2 })
  nearExpiryCount!: number;
}

export class SalesTrendPointDto {
  @ApiProperty({ example: '2026-10-21' })
  period!: string;

  @ApiProperty({ example: '150.00' })
  total!: string;

  @ApiProperty({ example: 2 })
  invoiceCount!: number;
}

export class ProductPointDto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ example: 'ABC Beer 330ml' })
  name!: string;

  @ApiProperty({ example: 'BEER-001' })
  sku!: string;

  @ApiProperty({ example: '576.00' })
  revenue!: string;

  @ApiProperty({ example: '288' })
  quantityBase!: string;
}

export class CategoryPointDto {
  @ApiProperty({ nullable: true, format: 'uuid' })
  categoryId!: string | null;

  @ApiProperty({ example: 'Beer' })
  name!: string;

  @ApiProperty({ example: '576.00' })
  total!: string;
}

export class CustomerPointDto {
  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ example: 'Sokha Restaurant' })
  name!: string;

  @ApiProperty({ example: '600.00' })
  total!: string;

  @ApiProperty({ example: '300.00' })
  balance!: string;
}

export class WeekdayPointDto {
  @ApiProperty({ example: 'Monday' })
  name!: string;

  @ApiProperty({ example: 1 })
  weekday!: number;

  @ApiProperty({ example: '300.00' })
  total!: string;

  @ApiProperty({ example: 4 })
  invoiceCount!: number;
}

export class SlowMovingPointDto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ example: 'ABC Beer 330ml' })
  name!: string;

  @ApiProperty({ example: 'BEER-001' })
  sku!: string;

  @ApiProperty({ example: '288' })
  currentStock!: string;

  @ApiProperty({ example: '0' })
  soldQuantity!: string;
}

export class PurchasesVersusSalesPointDto {
  @ApiProperty({ example: '2026-10-01' })
  period!: string;

  @ApiProperty({ example: '4500.00' })
  purchases!: string;

  @ApiProperty({ example: '4200.00' })
  sales!: string;
}

export class DashboardChartsDto {
  @ApiProperty({ type: [SalesTrendPointDto] })
  salesTrend!: SalesTrendPointDto[];

  @ApiProperty({ type: [ProductPointDto] })
  topProductsByRevenue!: ProductPointDto[];

  @ApiProperty({ type: [ProductPointDto] })
  topProductsByQuantity!: ProductPointDto[];

  @ApiProperty({ type: [CategoryPointDto] })
  salesByCategory!: CategoryPointDto[];

  @ApiProperty({ type: [CustomerPointDto] })
  topCustomersBySales!: CustomerPointDto[];

  @ApiProperty({ type: [CustomerPointDto] })
  topCustomersByBalance!: CustomerPointDto[];

  @ApiProperty({ type: () => AgeingBucketsDto })
  creditAgeing!: AgeingBucketsDto;

  @ApiProperty({ type: [WeekdayPointDto] })
  salesByWeekday!: WeekdayPointDto[];

  @ApiProperty({ type: [SlowMovingPointDto] })
  slowMovingStock!: SlowMovingPointDto[];

  @ApiProperty({ type: [PurchasesVersusSalesPointDto] })
  purchasesVersusSales!: PurchasesVersusSalesPointDto[];
}

export class DashboardDto {
  @ApiProperty({ type: () => DashboardKpiDto })
  kpis!: DashboardKpiDto;

  @ApiProperty({ type: () => DashboardChartsDto })
  charts!: DashboardChartsDto;
}

export class PlatformDepotPointDto {
  @ApiProperty({ example: '2026-10' })
  period!: string;

  @ApiProperty({ example: 3 })
  registered!: number;
}

export class PlatformPlanPointDto {
  @ApiProperty({ example: 'Standard' })
  plan!: string;

  @ApiProperty({ example: 4 })
  depots!: number;
}

export class PlatformPendingDto {
  @ApiProperty({ format: 'uuid' })
  depotId!: string;

  @ApiProperty({ example: 'New Depot' })
  name!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class PlatformDashboardDto {
  @ApiProperty({ example: 12 })
  totalDepots!: number;

  @ApiProperty({ example: 8 })
  activeDepots!: number;

  @ApiProperty({ example: 3 })
  pendingApprovals!: number;

  @ApiProperty({ type: [PlatformDepotPointDto] })
  registeredOverTime!: PlatformDepotPointDto[];

  @ApiProperty({ type: [PlatformPlanPointDto] })
  depotsByPlan!: PlatformPlanPointDto[];

  @ApiProperty({ type: [PlatformPendingDto] })
  pendingDepots!: PlatformPendingDto[];
}
