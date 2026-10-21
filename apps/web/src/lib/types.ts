export const USER_ROLES = ['PLATFORM_ADMIN', 'OWNER', 'SALES', 'STOCK_KEEPER', 'DELIVERY'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const DEPOT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;

export type DepotStatus = (typeof DEPOT_STATUSES)[number];

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  depotId: string | null;
  mustChangePassword: boolean;
}

export const STAFF_ROLES = ['SALES', 'STOCK_KEEPER', 'DELIVERY'] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const DEPOT_LOCALES = ['EN', 'KM'] as const;

export type DepotLocale = (typeof DEPOT_LOCALES)[number];

export interface DepotSettings {
  id: string;
  name: string;
  address: string | null;
  currency: string;
  locale: DepotLocale;
  invoiceFooter: string | null;
  logoKey: string | null;
}

export const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];

export interface PresignedUpload {
  url: string;
  key: string;
  contentType: string;
  method: string;
  expiresIn: number;
}

export interface PresignedRead {
  url: string;
  key: string;
  expiresIn: number;
}

export interface SessionDepot {
  id: string;
  name: string;
  status: DepotStatus;
}

export interface AuthSession {
  user: SessionUser;
  depot: SessionDepot | null;
  accessToken: string;
}

export type LogoutReason =
  | 'session-expired'
  | 'service-unavailable'
  | 'depot-pending'
  | 'depot-rejected'
  | 'depot-suspended'
  | 'logout';

export interface DepotAdminView {
  id: string;
  name: string;
  slug: string;
  phone: string;
  email: string;
  status: DepotStatus;
  statusReason: string | null;
  approvedAt: string | null;
  /** The active plan of the depot, or null when the depot has no plan. */
  plan: { code: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

// Catalog (FR-11 categories, FR-12 products, FR-13 units, FR-16 prices)

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const PRICE_TYPES = ['RETAIL', 'WHOLESALE'] as const;

export type PriceType = (typeof PRICE_TYPES)[number];

export interface ProductPrice {
  id: string;
  type: PriceType;
  amount: string;
  updatedAt: string;
}

export interface ProductUnit {
  id: string;
  name: string;
  conversionFactor: string;
  isBaseUnit: boolean;
  isActive: boolean;
  prices: ProductPrice[];
}

export interface ProductCategory {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: ProductCategory | null;
  reorderLevel: string;
  /** Last purchase cost for one base unit. */
  costPrice: string;
  trackBatches: boolean;
  isActive: boolean;
  baseUnit: ProductUnit;
  units: ProductUnit[];
  /** Current stock in the base unit, derived from the stock movement ledger. */
  currentStock: string;
  /** Current stock formatted in readable units, for example "12 cartons and 5 bottles". */
  currentStockReadable: string;
  /** True when the current stock is at or below the reorder level. */
  lowStock: boolean;
  createdAt: string;
  updatedAt: string;
  /** Optional until the product response exposes the stored image key. */
  imageKey?: string | null;
}

// Stock, suppliers, and purchases (FR-15, FR-17 to FR-21, FR-36 to FR-38)

export const STOCK_MOVEMENT_TYPES = ['PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN', 'DAMAGE'] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export interface StockBatch {
  id: string;
  batchNumber: string;
  expiryDate: string | null;
  currentStock: string;
  currentStockReadable: string;
}

export interface StockItem {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: ProductCategory | null;
  reorderLevel: string;
  costPrice: string;
  trackBatches: boolean;
  isActive: boolean;
  baseUnit: ProductUnit;
  units: ProductUnit[];
  currentStock: string;
  currentStockReadable: string;
  lowStock: boolean;
  batches: StockBatch[];
}

export interface StockMovement {
  id: string;
  type: StockMovementType;
  quantity: string;
  quantityReadable: string;
  unitCost: string | null;
  reason: string | null;
  product: { id: string; sku: string; name: string };
  batch: { id: string; batchNumber: string; expiryDate: string | null } | null;
  createdBy: { id: string; name: string } | null;
  saleOrderId: string | null;
  purchaseOrderId: string | null;
  createdAt: string;
}

export interface BatchStockAlert {
  id: string;
  batchNumber: string;
  expiryDate: string;
  daysToExpiry: number;
  productName: string;
  productSku: string;
  productId: string;
  currentStock: string;
  currentStockReadable: string;
}

export interface BatchAlerts {
  days: number;
  nearExpiry: BatchStockAlert[];
  expired: BatchStockAlert[];
}

export interface StockMovementResult {
  movementId: string;
  type: StockMovementType;
  quantity: string;
  quantityReadable: string;
  stockAfter: string;
  stockAfterReadable: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const PURCHASE_STATUSES = ['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED'] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export interface PurchaseLine {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  productUnitId: string;
  productUnitName: string;
  quantity: string;
  quantityBase: string;
  unitCost: string;
  unitCostPerBaseUnit: string;
  lineTotal: string;
  batchNumber: string | null;
  expiryDate: string | null;
}

export interface Purchase {
  id: string;
  referenceNumber: string;
  status: PurchaseStatus;
  supplier: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    isActive: boolean;
  };
  subtotal: string;
  discountTotal: string;
  total: string;
  orderedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  createdBy: { id: string; name: string };
  items: PurchaseLine[];
  createdAt: string;
  updatedAt: string;
}

export interface PriceHistoryEntry {
  id: string;
  productId: string;
  productUnitId: string;
  productUnitName: string;
  type: PriceType;
  oldAmount: string | null;
  newAmount: string;
  changedBy: { id: string; name: string } | null;
  createdAt: string;
}

// Customers, invoices, payments, and credit (FR-23 to FR-35)

export const CUSTOMER_TYPES = ['RETAIL', 'WHOLESALE'] as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  type: CustomerType;
  creditLimit: string | null;
  paymentTermDays: number | null;
  notes: string | null;
  isActive: boolean;
  isWalkIn: boolean;
  /** Outstanding balance derived from the invoices and the payments. */
  balance: string;
  createdAt: string;
  updatedAt: string;
}

export const PAYMENT_STATUSES = ['PAID', 'PARTIAL', 'UNPAID'] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'OTHER'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const DISCOUNT_TYPES = ['AMOUNT', 'PERCENT'] as const;

export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export interface InvoiceBatch {
  id: string;
  batchNumber: string;
  expiryDate: string | null;
  quantity: string;
}

export interface InvoiceLine {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  productUnitId: string;
  productUnitName: string;
  quantity: string;
  quantityBase: string;
  quantityReadable: string;
  unitPrice: string;
  discountAmount: string;
  discountType: DiscountType | null;
  discountValue: string | null;
  lineTotal: string;
  costPerBaseUnit: string | null;
  batches: InvoiceBatch[];
}

export interface InvoicePayment {
  id: string;
  amount: string;
  method: PaymentMethod;
  paidAt: string;
  reference: string | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: 'DRAFT' | 'COMPLETED' | 'VOIDED';
  paymentStatus: PaymentStatus;
  customerId: string;
  customerName: string;
  subtotal: string;
  discountTotal: string;
  discountType: DiscountType | null;
  discountValue: string | null;
  total: string;
  outstanding: string;
  paidAmount: string;
  refundDue: string;
  orderDate: string;
  dueDate: string | null;
  notes: string | null;
  voidReason: string | null;
  voidedAt: string | null;
  createdBy: string;
  items: InvoiceLine[];
  payments: InvoicePayment[];
  creditLimitWarning: string | null;
}

export interface PaymentAllocation {
  invoiceId: string;
  invoiceNumber: string;
  amount: string;
}

export interface Payment {
  id: string;
  customerId: string;
  customerName: string;
  amount: string;
  allocatedAmount: string;
  unallocatedAmount: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  paidAt: string;
  receivedBy: string | null;
  allocations: PaymentAllocation[];
  createdAt: string;
}

export interface CustomerStatementLine {
  date: string;
  type: 'INVOICE' | 'PAYMENT';
  reference: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
}

export interface CustomerStatement {
  customer: Customer;
  openingBalance: string;
  totalInvoiced: string;
  totalPaid: string;
  closingBalance: string;
  lines: CustomerStatementLine[];
}

export interface AgeingBucket {
  key: string;
  minDays: number;
  maxDays: number | null;
  invoiceCount: number;
  amount: string;
}

export interface CreditOverview {
  totalOutstanding: string;
  totalOverdue: string;
  openInvoiceCount: number;
  overdueInvoiceCount: number;
  totalRefundDue: string;
  ageing: AgeingBucket[];
}

export interface OverdueInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  total: string;
  outstanding: string;
  orderDate: string;
  dueDate: string | null;
  daysOverdue: number;
  ageingBucket: string;
}

export interface RegisteredDepot {
  depot: {
    id: string;
    name: string;
    status: DepotStatus;
  };
  owner: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

// Reports, dashboard, and platform data (FR-5, FR-42 to FR-49)

export const REPORT_UNITS = ['day', 'week', 'month', 'custom'] as const;

export type ReportUnit = (typeof REPORT_UNITS)[number];

export interface SalesReportTotals {
  invoiceCount: number;
  subtotal: string;
  discountTotal: string;
  total: string;
  paid: string;
  outstanding: string;
}

export interface SalesReportRow {
  /** The day, week, or month label of the row, for example 2026-10-21 or 2026-10-01. */
  period: string;
  periodStart: string;
  invoiceCount: number;
  total: string;
  /** The sales staff only get the totals and the trend, so the other amounts can be missing. */
  subtotal?: string;
  discountTotal?: string;
  paid?: string;
  outstanding?: string;
}

export interface SalesReport {
  from: string;
  to: string;
  unit: string;
  timeZone: string;
  totals: SalesReportTotals;
  rows: SalesReportRow[];
}

export interface SalesProductRow {
  productId: string;
  sku: string;
  name: string;
  category: string | null;
  quantityBase: string;
  revenue: string;
  cost: string;
  profit: string;
  marginPercent: string | null;
}

export interface SalesGroupRow {
  groupId: string;
  name: string;
  detail: string | null;
  invoiceCount: number;
  subtotal: string;
  discountTotal: string;
  total: string;
  paid: string;
  outstanding: string;
}

export interface InventoryBatchRow {
  batchId: string;
  batchNumber: string;
  expiryDate: string | null;
  stock: string;
  expired: boolean;
}

export interface InventoryReportRow {
  productId: string;
  sku: string;
  name: string;
  category: string | null;
  isActive: boolean;
  trackBatches: boolean;
  currentStock: string;
  currentStockReadable: string;
  reorderLevel: string;
  lowStock: boolean;
  costPerBaseUnit: string;
  stockValue: string;
  batches: InventoryBatchRow[];
}

export interface InventoryReport {
  productCount: number;
  lowStockCount: number;
  nearExpiryBatchCount: number;
  totalStockValue: string;
  rows: InventoryReportRow[];
}

export interface ReportAgeingBuckets {
  '0-30': string;
  '31-60': string;
  OVER_60: string;
}

export interface CreditReportRow {
  customerId: string;
  name: string;
  type: string;
  creditLimit: string | null;
  paymentTermDays: number | null;
  invoiced: string;
  paid: string;
  outstanding: string;
  overdue: string;
  ageing: ReportAgeingBuckets;
}

export interface CreditReport {
  totalOutstanding: string;
  totalOverdue: string;
  rows: CreditReportRow[];
}

export interface ProfitReport {
  revenue: string;
  cost: string;
  profit: string;
  marginPercent: string | null;
  rows: SalesProductRow[];
}

export interface PurchaseReportRow {
  supplierId: string;
  name: string;
  period: string;
  purchaseCount: number;
  subtotal: string;
  total: string;
}

export interface PurchaseReport {
  totalPurchases: string;
  rows: PurchaseReportRow[];
}

export interface DashboardKpis {
  todaySales: string;
  monthSales: string;
  monthInvoiceCount: number;
  totalOutstandingCredit: string;
  overdueAmount: string;
  monthGrossProfit: string;
  monthMarginPercent: string | null;
  lowStockCount: number;
  nearExpiryCount: number;
}

export interface SalesTrendPoint {
  period: string;
  total: string;
  invoiceCount: number;
}

export interface ProductChartPoint {
  productId: string;
  name: string;
  sku: string;
  revenue: string;
  quantityBase: string;
}

export interface CategoryChartPoint {
  categoryId: string | null;
  name: string;
  total: string;
}

export interface CustomerChartPoint {
  customerId: string;
  name: string;
  total: string;
  balance: string;
}

export interface WeekdayChartPoint {
  name: string;
  weekday: number;
  total: string;
  invoiceCount: number;
}

export interface SlowMovingPoint {
  productId: string;
  name: string;
  sku: string;
  currentStock: string;
  soldQuantity: string;
}

export interface PurchasesVersusSalesPoint {
  period: string;
  purchases: string;
  sales: string;
}

export interface DashboardCharts {
  salesTrend: SalesTrendPoint[];
  topProductsByRevenue: ProductChartPoint[];
  topProductsByQuantity: ProductChartPoint[];
  salesByCategory: CategoryChartPoint[];
  topCustomersBySales: CustomerChartPoint[];
  topCustomersByBalance: CustomerChartPoint[];
  creditAgeing: ReportAgeingBuckets;
  salesByWeekday: WeekdayChartPoint[];
  slowMovingStock: SlowMovingPoint[];
  purchasesVersusSales: PurchasesVersusSalesPoint[];
}

export interface Dashboard {
  kpis: DashboardKpis;
  charts: DashboardCharts;
}

export interface PlatformDepotPoint {
  period: string;
  registered: number;
}

export interface PlatformPlanPoint {
  plan: string;
  depots: number;
}

export interface PlatformPendingDepot {
  depotId: string;
  name: string;
  createdAt: string;
}

export interface PlatformDashboard {
  totalDepots: number;
  activeDepots: number;
  pendingApprovals: number;
  registeredOverTime: PlatformDepotPoint[];
  depotsByPlan: PlatformPlanPoint[];
  pendingDepots: PlatformPendingDepot[];
}

// Plans and the audit log (FR-4, FR-50, FR-51)

export const PLAN_CODES = ['FREE_TRIAL', 'BASIC', 'PRO'] as const;

export type PlanCode = (typeof PLAN_CODES)[number];

export interface Plan {
  id: string;
  code: string;
  name: string;
  /** The monthly price for display only. The billing is simulated. */
  priceMonthly: string;
  maxUsers: number | null;
  maxProducts: number | null;
  isActive: boolean;
}

export interface DepotPlan {
  plan: Plan | null;
  usage: { users: number; products: number };
  limits: { users: number | null; products: number | null };
  /** True when the depot uses more than the plan of the depot allows. */
  overLimit: boolean;
}

export interface AuditLogActor {
  id: string;
  name: string;
  role: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: AuditLogActor | null;
  ipAddress: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
