'use client';

import { ApiError, networkError, parseErrorResponse } from '@/lib/api-error';
import { refreshAccessToken } from '@/lib/session-client';
import type {
  AgeingBucket,
  AuditLogEntry,
  BatchAlerts,
  Category,
  CreditOverview,
  CreditReport,
  Customer,
  CustomerStatement,
  CustomerType,
  Dashboard,
  DepotAdminView,
  DepotLocale,
  DepotPlan,
  DepotSettings,
  DepotStatus,
  DiscountType,
  ImageContentType,
  InventoryReport,
  Invoice,
  OverdueInvoice,
  Paginated,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Plan,
  PlatformDashboard,
  PresignedRead,
  PresignedUpload,
  ProfitReport,
  PriceHistoryEntry,
  PriceType,
  Product,
  ProductPrice,
  ProductUnit,
  Purchase,
  PurchaseReport,
  PurchaseStatus,
  RegisteredDepot,
  ReportUnit,
  SalesGroupRow,
  SalesProductRow,
  SalesReport,
  StaffRole,
  StaffUser,
  StockItem,
  StockMovement,
  StockMovementResult,
  StockMovementType,
  Supplier,
} from '@/lib/types';
import { getAccessToken } from '@/stores/session-store';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '/api/v1').replace(/\/+$/, '');

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
}

function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildInit(options: RequestOptions, accessToken: string | null): RequestInit {
  const headers: Record<string, string> = { accept: 'application/json' };
  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
      body = options.body;
    } else {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
  }

  if (options.auth !== false && accessToken !== null) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  return {
    method: options.method ?? 'GET',
    headers,
    body,
    credentials: 'same-origin',
    cache: 'no-store',
  };
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const accessToken = getAccessToken();
  let response: Response;

  try {
    response = await fetch(apiUrl(path), buildInit(options, accessToken));
  } catch {
    throw networkError();
  }

  if (response.status === 401 && options.auth !== false && options.retryOnUnauthorized !== false) {
    const refresh = await refreshAccessToken();

    if (refresh.ok) {
      return apiRequest<T>(path, { ...options, retryOnUnauthorized: false });
    }

    throw await parseErrorResponse(response);
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();

  if (text.trim() === '') {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export interface RegisterDepotInput {
  depotName: string;
  ownerName: string;
  phone: string;
  email: string;
  password: string;
}

export function registerDepot(input: RegisterDepotInput): Promise<RegisteredDepot> {
  return apiRequest<RegisteredDepot>('/auth/register', {
    method: 'POST',
    body: input,
    auth: false,
  });
}

export interface ListDepotsParams {
  status?: DepotStatus | '';
  page?: number;
  pageSize?: number;
}

export function listDepots({ status, page = 1, pageSize = 20 }: ListDepotsParams = {}): Promise<
  Paginated<DepotAdminView>
> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort: 'createdAt',
    order: 'desc',
  });

  if (status !== undefined && status !== '') {
    params.set('status', status);
  }

  return apiRequest<Paginated<DepotAdminView>>(`/platform/depots?${params.toString()}`);
}

export function approveDepot(id: string): Promise<DepotAdminView> {
  return apiRequest<DepotAdminView>(`/platform/depots/${id}/approve`, { method: 'POST' });
}

export function rejectDepot(id: string, reason: string): Promise<DepotAdminView> {
  return apiRequest<DepotAdminView>(`/platform/depots/${id}/reject`, {
    method: 'POST',
    body: { reason },
  });
}

export function suspendDepot(id: string, reason: string): Promise<DepotAdminView> {
  return apiRequest<DepotAdminView>(`/platform/depots/${id}/suspend`, {
    method: 'POST',
    body: { reason },
  });
}

export interface ListStaffParams {
  role?: StaffRole | '';
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function listStaff({
  role,
  isActive,
  search,
  page = 1,
  pageSize = 10,
}: ListStaffParams = {}): Promise<Paginated<StaffUser>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort: 'createdAt',
    order: 'desc',
  });

  if (role !== undefined && role !== '') {
    params.set('role', role);
  }

  if (isActive !== undefined) {
    params.set('isActive', String(isActive));
  }

  if (search !== undefined && search.trim() !== '') {
    params.set('search', search.trim());
  }

  return apiRequest<Paginated<StaffUser>>(`/users?${params.toString()}`);
}

export interface CreateStaffInput {
  name: string;
  email: string;
  phone?: string;
  role: StaffRole;
  password: string;
}

export type UpdateStaffInput = Partial<{
  name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  isActive: boolean;
}>;

export function createStaff(input: CreateStaffInput): Promise<StaffUser> {
  return apiRequest<StaffUser>('/users', { method: 'POST', body: input });
}

export function updateStaff(id: string, input: UpdateStaffInput): Promise<StaffUser> {
  return apiRequest<StaffUser>(`/users/${id}`, { method: 'PATCH', body: input });
}

export function deactivateStaff(id: string): Promise<StaffUser> {
  return apiRequest<StaffUser>(`/users/${id}/deactivate`, { method: 'POST' });
}

export interface ResetStaffPasswordResult {
  id: string;
  mustChangePassword: boolean;
}

export function resetStaffPassword(
  id: string,
  newPassword: string,
): Promise<ResetStaffPasswordResult> {
  return apiRequest<ResetStaffPasswordResult>(`/users/${id}/reset-password`, {
    method: 'POST',
    body: { newPassword },
  });
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export function changeOwnPassword(
  input: ChangePasswordInput,
): Promise<{ mustChangePassword: boolean }> {
  return apiRequest<{ mustChangePassword: boolean }>('/auth/change-password', {
    method: 'POST',
    body: input,
  });
}

export function getDepotSettings(): Promise<DepotSettings> {
  return apiRequest<DepotSettings>('/depot/settings');
}

export interface UpdateDepotSettingsInput {
  name?: string;
  address?: string | null;
  currency?: string;
  locale?: DepotLocale;
  invoiceFooter?: string | null;
}

export function updateDepotSettings(input: UpdateDepotSettingsInput): Promise<DepotSettings> {
  return apiRequest<DepotSettings>('/depot/settings', { method: 'PATCH', body: input });
}

// File storage (depot logo and product images)

export function requestLogoUploadUrl(contentType: ImageContentType): Promise<PresignedUpload> {
  return apiRequest<PresignedUpload>('/storage/logo/upload-url', {
    method: 'POST',
    body: { contentType },
  });
}

export function requestLogoReadUrl(): Promise<PresignedRead> {
  return apiRequest<PresignedRead>('/storage/logo/read-url', { method: 'POST' });
}

export function confirmLogoImage(key: string): Promise<{ key: string }> {
  return apiRequest<{ key: string }>('/storage/logo/confirm', { method: 'POST', body: { key } });
}

export function requestProductImageUploadUrl(
  productId: string,
  contentType: ImageContentType,
): Promise<PresignedUpload> {
  return apiRequest<PresignedUpload>(`/storage/products/${productId}/image-upload-url`, {
    method: 'POST',
    body: { contentType },
  });
}

export function requestProductImageReadUrl(productId: string): Promise<PresignedRead> {
  return apiRequest<PresignedRead>(`/storage/products/${productId}/image-read-url`, {
    method: 'POST',
  });
}

export function confirmProductImage(productId: string, key: string): Promise<{ key: string }> {
  return apiRequest<{ key: string }>(`/storage/products/${productId}/image-confirm`, {
    method: 'POST',
    body: { key },
  });
}

// Categories (FR-11)

export interface ListCategoriesParams {
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sort?: 'name' | 'createdAt' | 'isActive';
  order?: 'asc' | 'desc';
}

export function listCategories({
  search,
  isActive,
  page = 1,
  pageSize = 20,
  sort = 'name',
  order = 'asc',
}: ListCategoriesParams = {}): Promise<Paginated<Category>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
    order,
  });

  if (search !== undefined && search.trim() !== '') {
    params.set('search', search.trim());
  }

  if (isActive !== undefined) {
    params.set('isActive', String(isActive));
  }

  return apiRequest<Paginated<Category>>(`/categories?${params.toString()}`);
}

export function createCategory(input: { name: string }): Promise<Category> {
  return apiRequest<Category>('/categories', { method: 'POST', body: input });
}

export function updateCategory(id: string, input: { name: string }): Promise<Category> {
  return apiRequest<Category>(`/categories/${id}`, { method: 'PATCH', body: input });
}

export function archiveCategory(id: string): Promise<Category> {
  return apiRequest<Category>(`/categories/${id}/archive`, { method: 'POST' });
}

// Products, units, and prices (FR-12, FR-13, FR-16)

export type ProductSort = 'name' | 'sku' | 'createdAt' | 'reorderLevel' | 'isActive';

export interface ListProductsParams {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sort?: ProductSort;
  order?: 'asc' | 'desc';
}

export function listProducts({
  search,
  categoryId,
  isActive,
  page = 1,
  pageSize = 10,
  sort = 'name',
  order = 'asc',
}: ListProductsParams = {}): Promise<Paginated<Product>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
    order,
  });

  if (search !== undefined && search.trim() !== '') {
    params.set('search', search.trim());
  }

  if (categoryId !== undefined && categoryId !== '') {
    params.set('categoryId', categoryId);
  }

  if (isActive !== undefined) {
    params.set('isActive', String(isActive));
  }

  return apiRequest<Paginated<Product>>(`/products?${params.toString()}`);
}

export function getProduct(id: string): Promise<Product> {
  return apiRequest<Product>(`/products/${id}`);
}

export interface CreateProductUnitInput {
  name: string;
  conversionFactor: string;
}

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  reorderLevel?: string;
  trackBatches?: boolean;
  baseUnit: string;
  units?: CreateProductUnitInput[];
}

export type UpdateProductInput = Partial<{
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  reorderLevel: string;
  trackBatches: boolean;
}>;

export function createProduct(input: CreateProductInput): Promise<Product> {
  return apiRequest<Product>('/products', { method: 'POST', body: input });
}

export function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
  return apiRequest<Product>(`/products/${id}`, { method: 'PATCH', body: input });
}

export function archiveProduct(id: string): Promise<Product> {
  return apiRequest<Product>(`/products/${id}/archive`, { method: 'POST' });
}

export function createProductUnit(
  productId: string,
  input: CreateProductUnitInput,
): Promise<ProductUnit> {
  return apiRequest<ProductUnit>(`/products/${productId}/units`, {
    method: 'POST',
    body: input,
  });
}

export function updateProductUnit(
  productId: string,
  unitId: string,
  input: Partial<CreateProductUnitInput>,
): Promise<ProductUnit> {
  return apiRequest<ProductUnit>(`/products/${productId}/units/${unitId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function archiveProductUnit(productId: string, unitId: string): Promise<ProductUnit> {
  return apiRequest<ProductUnit>(`/products/${productId}/units/${unitId}/archive`, {
    method: 'POST',
  });
}

export function setProductPrice(
  productId: string,
  unitId: string,
  type: PriceType,
  amount: string,
): Promise<ProductPrice> {
  return apiRequest<ProductPrice>(`/products/${productId}/units/${unitId}/prices/${type}`, {
    method: 'PUT',
    body: { amount },
  });
}

// Price history (read-only)

export interface ListPriceHistoryParams {
  type?: PriceType;
  page?: number;
  pageSize?: number;
}

export function listPriceHistory(
  productId: string,
  unitId: string,
  { type, page = 1, pageSize = 20 }: ListPriceHistoryParams = {},
): Promise<Paginated<PriceHistoryEntry>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (type !== undefined) {
    params.set('type', type);
  }

  return apiRequest<Paginated<PriceHistoryEntry>>(
    `/products/${productId}/units/${unitId}/prices?${params.toString()}`,
  );
}

// Stock (FR-17 to FR-21)

export interface ListStockParams {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  lowStock?: boolean;
  page?: number;
  pageSize?: number;
  sort?: 'name' | 'sku' | 'currentStock';
  order?: 'asc' | 'desc';
}

export function listStock({
  search,
  categoryId,
  isActive,
  lowStock,
  page = 1,
  pageSize = 20,
  sort = 'name',
  order = 'asc',
}: ListStockParams = {}): Promise<Paginated<StockItem>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
    order,
  });

  if (search !== undefined && search.trim() !== '') {
    params.set('search', search.trim());
  }

  if (categoryId !== undefined && categoryId !== '') {
    params.set('categoryId', categoryId);
  }

  if (isActive !== undefined) {
    params.set('isActive', String(isActive));
  }

  if (lowStock !== undefined) {
    params.set('lowStock', String(lowStock));
  }

  return apiRequest<Paginated<StockItem>>(`/stock?${params.toString()}`);
}

export function listLowStock({ search, page = 1, pageSize = 20 }: ListStockParams = {}): Promise<
  Paginated<StockItem>
> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort: 'name',
    order: 'asc',
  });

  if (search !== undefined && search.trim() !== '') {
    params.set('search', search.trim());
  }

  return apiRequest<Paginated<StockItem>>(`/stock/low-stock?${params.toString()}`);
}

export interface ListStockMovementsParams {
  productId?: string;
  type?: StockMovementType;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function listStockMovements({
  productId,
  type,
  from,
  to,
  page = 1,
  pageSize = 20,
}: ListStockMovementsParams = {}): Promise<Paginated<StockMovement>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (productId !== undefined && productId !== '') {
    params.set('productId', productId);
  }

  if (type !== undefined) {
    params.set('type', type);
  }

  if (from !== undefined && from !== '') {
    params.set('from', from);
  }

  if (to !== undefined && to !== '') {
    params.set('to', to);
  }

  return apiRequest<Paginated<StockMovement>>(`/stock/movements?${params.toString()}`);
}

export function getBatchAlerts(days = 30): Promise<BatchAlerts> {
  return apiRequest<BatchAlerts>(`/stock/batches/alerts?days=${days}`);
}

export interface StockMovementInput {
  productId: string;
  unitId: string;
  quantity: string;
  reason: string;
  batchId?: string | null;
}

export function createStockAdjustment(input: StockMovementInput): Promise<StockMovementResult> {
  return apiRequest<StockMovementResult>('/stock/adjustments', { method: 'POST', body: input });
}

export function createStockDamage(input: StockMovementInput): Promise<StockMovementResult> {
  return apiRequest<StockMovementResult>('/stock/damage', { method: 'POST', body: input });
}

// Suppliers (FR-36)

export interface ListSuppliersParams {
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sort?: 'name' | 'createdAt' | 'isActive';
  order?: 'asc' | 'desc';
}

export function listSuppliers({
  search,
  isActive,
  page = 1,
  pageSize = 20,
  sort = 'name',
  order = 'asc',
}: ListSuppliersParams = {}): Promise<Paginated<Supplier>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
    order,
  });

  if (search !== undefined && search.trim() !== '') {
    params.set('search', search.trim());
  }

  if (isActive !== undefined) {
    params.set('isActive', String(isActive));
  }

  return apiRequest<Paginated<Supplier>>(`/suppliers?${params.toString()}`);
}

export interface SupplierInput {
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}

export function createSupplier(input: SupplierInput): Promise<Supplier> {
  return apiRequest<Supplier>('/suppliers', { method: 'POST', body: input });
}

export function updateSupplier(id: string, input: Partial<SupplierInput>): Promise<Supplier> {
  return apiRequest<Supplier>(`/suppliers/${id}`, { method: 'PATCH', body: input });
}

export function archiveSupplier(id: string): Promise<Supplier> {
  return apiRequest<Supplier>(`/suppliers/${id}/archive`, { method: 'POST' });
}

// Purchases (FR-37, FR-38)

export interface ListPurchasesParams {
  status?: PurchaseStatus | '';
  supplierId?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sort?: 'createdAt' | 'referenceNumber' | 'status';
  order?: 'asc' | 'desc';
}

export function listPurchases({
  status,
  supplierId,
  search,
  from,
  to,
  page = 1,
  pageSize = 20,
  sort = 'createdAt',
  order = 'desc',
}: ListPurchasesParams = {}): Promise<Paginated<Purchase>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
    order,
  });

  if (status !== undefined && status !== '') {
    params.set('status', status);
  }

  if (supplierId !== undefined && supplierId !== '') {
    params.set('supplierId', supplierId);
  }

  if (search !== undefined && search.trim() !== '') {
    params.set('search', search.trim());
  }

  if (from !== undefined && from !== '') {
    params.set('from', from);
  }

  if (to !== undefined && to !== '') {
    params.set('to', to);
  }

  return apiRequest<Paginated<Purchase>>(`/purchases?${params.toString()}`);
}

export function getPurchase(id: string): Promise<Purchase> {
  return apiRequest<Purchase>(`/purchases/${id}`);
}

export interface PurchaseLineInput {
  productId: string;
  unitId: string;
  quantity: string;
  unitCost: string;
  batchNumber?: string | null;
  expiryDate?: string | null;
}

export interface CreatePurchaseInput {
  supplierId: string;
  referenceNumber?: string;
  notes?: string | null;
  lines: PurchaseLineInput[];
}

export interface UpdatePurchaseInput {
  supplierId?: string;
  notes?: string | null;
  lines?: PurchaseLineInput[];
}

export function createPurchase(input: CreatePurchaseInput): Promise<Purchase> {
  return apiRequest<Purchase>('/purchases', { method: 'POST', body: input });
}

export function updatePurchase(id: string, input: UpdatePurchaseInput): Promise<Purchase> {
  return apiRequest<Purchase>(`/purchases/${id}`, { method: 'PATCH', body: input });
}

export function receivePurchase(id: string): Promise<Purchase> {
  return apiRequest<Purchase>(`/purchases/${id}/receive`, { method: 'POST' });
}

export function cancelPurchase(id: string, reason?: string | null): Promise<Purchase> {
  return apiRequest<Purchase>(`/purchases/${id}/cancel`, {
    method: 'POST',
    body: { reason: reason ?? null },
  });
}

// Customers, invoices, payments, and credit (FR-23 to FR-35)

export interface ListCustomersParams {
  search?: string;
  type?: CustomerType | '';
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sort?: 'name' | 'createdAt';
  order?: 'asc' | 'desc';
}

export function listCustomers({
  search,
  type,
  isActive,
  page = 1,
  pageSize = 20,
  sort = 'name',
  order = 'asc',
}: ListCustomersParams = {}): Promise<Paginated<Customer>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
    order,
  });

  if (search !== undefined && search.trim() !== '') {
    params.set('search', search.trim());
  }

  if (type !== undefined && type !== '') {
    params.set('type', type);
  }

  if (isActive !== undefined) {
    params.set('isActive', String(isActive));
  }

  return apiRequest<Paginated<Customer>>(`/customers?${params.toString()}`);
}

export function getCustomer(id: string): Promise<Customer> {
  return apiRequest<Customer>(`/customers/${id}`);
}

export interface CustomerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  type?: CustomerType;
  creditLimit?: string | null;
  paymentTermDays?: number | null;
  notes?: string | null;
}

export function createCustomer(input: CustomerInput): Promise<Customer> {
  return apiRequest<Customer>('/customers', { method: 'POST', body: input });
}

export function updateCustomer(id: string, input: Partial<CustomerInput>): Promise<Customer> {
  return apiRequest<Customer>(`/customers/${id}`, { method: 'PATCH', body: input });
}

export function archiveCustomer(id: string): Promise<Customer> {
  return apiRequest<Customer>(`/customers/${id}/archive`, { method: 'POST' });
}

export function getCustomerStatement(id: string): Promise<CustomerStatement> {
  return apiRequest<CustomerStatement>(`/customers/${id}/statement`);
}

export interface ListInvoicesParams {
  customerId?: string;
  status?: 'DRAFT' | 'COMPLETED' | 'VOIDED' | '';
  paymentStatus?: PaymentStatus | '';
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sort?: 'orderDate' | 'invoiceNumber' | 'total';
  order?: 'asc' | 'desc';
}

export function listInvoices({
  customerId,
  status,
  paymentStatus,
  search,
  from,
  to,
  page = 1,
  pageSize = 20,
  sort = 'orderDate',
  order = 'desc',
}: ListInvoicesParams = {}): Promise<Paginated<Invoice>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
    order,
  });

  if (customerId !== undefined && customerId !== '') {
    params.set('customerId', customerId);
  }

  if (status !== undefined && status !== '') {
    params.set('status', status);
  }

  if (paymentStatus !== undefined && paymentStatus !== '') {
    params.set('paymentStatus', paymentStatus);
  }

  if (search !== undefined && search.trim() !== '') {
    params.set('search', search.trim());
  }

  if (from !== undefined && from !== '') {
    params.set('from', from);
  }

  if (to !== undefined && to !== '') {
    params.set('to', to);
  }

  return apiRequest<Paginated<Invoice>>(`/invoices?${params.toString()}`);
}

export function getInvoice(id: string): Promise<Invoice> {
  return apiRequest<Invoice>(`/invoices/${id}`);
}

export interface InvoiceLineInput {
  productId: string;
  unitId: string;
  quantity: string;
  unitPrice?: string | null;
  discount?: { type: DiscountType; value: string } | null;
}

export interface CreateInvoiceInput {
  customerId: string;
  lines: InvoiceLineInput[];
  discount?: { type: DiscountType; value: string } | null;
  notes?: string | null;
  payment?: { amount: string; method: PaymentMethod; reference?: string | null } | null;
  idempotencyKey?: string | null;
}

export function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  return apiRequest<Invoice>('/invoices', { method: 'POST', body: input });
}

export function voidInvoice(id: string, reason: string): Promise<Invoice> {
  return apiRequest<Invoice>(`/invoices/${id}/void`, { method: 'POST', body: { reason } });
}

export interface RecordPaymentInput {
  customerId: string;
  amount: string;
  method: PaymentMethod;
  paidAt?: string;
  reference?: string | null;
  notes?: string | null;
  allocations?: Array<{ invoiceId: string; amount: string }>;
}

export function recordPayment(input: RecordPaymentInput): Promise<Payment> {
  return apiRequest<Payment>('/payments', { method: 'POST', body: input });
}

export interface ListPaymentsParams {
  customerId?: string;
  method?: PaymentMethod | '';
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sort?: 'paidAt' | 'amount';
  order?: 'asc' | 'desc';
}

export function listPayments({
  customerId,
  method,
  from,
  to,
  page = 1,
  pageSize = 20,
  sort = 'paidAt',
  order = 'desc',
}: ListPaymentsParams = {}): Promise<Paginated<Payment>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
    order,
  });

  if (customerId !== undefined && customerId !== '') {
    params.set('customerId', customerId);
  }

  if (method !== undefined && method !== '') {
    params.set('method', method);
  }

  if (from !== undefined && from !== '') {
    params.set('from', from);
  }

  if (to !== undefined && to !== '') {
    params.set('to', to);
  }

  return apiRequest<Paginated<Payment>>(`/payments?${params.toString()}`);
}

export function getCreditOverview(): Promise<CreditOverview> {
  return apiRequest<CreditOverview>('/credit/overview');
}

export function getCreditOverdue(page = 1, pageSize = 20): Promise<Paginated<OverdueInvoice>> {
  return apiRequest<Paginated<OverdueInvoice>>(`/credit/overdue?page=${page}&pageSize=${pageSize}`);
}

export function getCreditAgeing(): Promise<{ ageing: AgeingBucket[] }> {
  return apiRequest<{ ageing: AgeingBucket[] }>('/credit/ageing');
}

// Reports, dashboard, and platform data (FR-5, FR-42 to FR-49)

export interface ReportRangeParams {
  /** First day of the range in the time of the depot, as YYYY-MM-DD. */
  from?: string;
  /** Last day of the range in the time of the depot, as YYYY-MM-DD. */
  to?: string;
}

export interface SalesReportParams extends ReportRangeParams {
  unit?: ReportUnit;
}

export interface InventoryReportParams {
  expiryDays?: number;
}

function rangeParams(params: ReportRangeParams): URLSearchParams {
  const search = new URLSearchParams();

  if (params.from !== undefined && params.from !== '') {
    search.set('from', params.from);
  }

  if (params.to !== undefined && params.to !== '') {
    search.set('to', params.to);
  }

  return search;
}

function withSearch(path: string, search: URLSearchParams): string {
  const query = search.toString();

  return query === '' ? path : `${path}?${query}`;
}

export function getSalesReport({
  from,
  to,
  unit = 'day',
}: SalesReportParams = {}): Promise<SalesReport> {
  const search = rangeParams({ from, to });
  search.set('unit', unit);

  return apiRequest<SalesReport>(withSearch('/reports/sales', search));
}

export function getSalesByProductReport(
  params: ReportRangeParams = {},
): Promise<SalesProductRow[]> {
  return apiRequest<SalesProductRow[]>(
    withSearch('/reports/sales/by-product', rangeParams(params)),
  );
}

export function getSalesByCategoryReport(params: ReportRangeParams = {}): Promise<SalesGroupRow[]> {
  return apiRequest<SalesGroupRow[]>(withSearch('/reports/sales/by-category', rangeParams(params)));
}

export function getSalesByCustomerReport(params: ReportRangeParams = {}): Promise<SalesGroupRow[]> {
  return apiRequest<SalesGroupRow[]>(withSearch('/reports/sales/by-customer', rangeParams(params)));
}

export function getSalesByStaffReport(params: ReportRangeParams = {}): Promise<SalesGroupRow[]> {
  return apiRequest<SalesGroupRow[]>(withSearch('/reports/sales/by-staff', rangeParams(params)));
}

export function getInventoryReport({
  expiryDays = 30,
}: InventoryReportParams = {}): Promise<InventoryReport> {
  return apiRequest<InventoryReport>(`/reports/inventory?expiryDays=${expiryDays}`);
}

export function getCreditReport(): Promise<CreditReport> {
  return apiRequest<CreditReport>('/reports/credit');
}

export function getProfitReport(params: ReportRangeParams = {}): Promise<ProfitReport> {
  return apiRequest<ProfitReport>(withSearch('/reports/profit', rangeParams(params)));
}

export function getPurchasesReport(params: ReportRangeParams = {}): Promise<PurchaseReport> {
  return apiRequest<PurchaseReport>(withSearch('/reports/purchases', rangeParams(params)));
}

export function getDashboard(): Promise<Dashboard> {
  return apiRequest<Dashboard>('/dashboard');
}

export function getPlatformDashboard(): Promise<PlatformDashboard> {
  return apiRequest<PlatformDashboard>('/platform/dashboard');
}

/**
 * Downloads a report as a CSV file. The API answers the CSV with the same token as the JSON, so
 * the file is fetched with the access token and then handed to the browser as a download.
 */
export async function downloadReportCsv(
  fileName: string,
  path: string,
  params: URLSearchParams = new URLSearchParams(),
): Promise<void> {
  const accessToken = getAccessToken();
  const search = new URLSearchParams(params);
  search.set('format', 'csv');

  const response = await fetch(apiUrl(withSearch(path, search)), {
    method: 'GET',
    headers: {
      accept: 'text/csv',
      ...(accessToken === null ? {} : { authorization: `Bearer ${accessToken}` }),
    },
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

// Plans and the audit log (FR-4, FR-50, FR-51)

/** The plan of the depot of the caller with the usage against the limits. */
export function getDepotPlan(): Promise<DepotPlan> {
  return apiRequest<DepotPlan>('/depot/plan');
}

/** Every plan of the platform. Platform Admin only. */
export function listPlans(): Promise<Plan[]> {
  return apiRequest<Plan[]>('/platform/plans');
}

/** Moves a depot to another plan. Platform Admin only. */
export function changeDepotPlan(depotId: string, planCode: string): Promise<DepotPlan> {
  return apiRequest<DepotPlan>(`/platform/depots/${depotId}/plan`, {
    method: 'PATCH',
    body: { planCode },
  });
}

export interface ListAuditLogParams {
  action?: string;
  actorUserId?: string;
  entityType?: string;
  from?: string;
  to?: string;
  sort?: 'createdAt' | 'action' | 'entityType';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

function auditLogParams(params: ListAuditLogParams): URLSearchParams {
  const search = new URLSearchParams({
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 20),
  });

  if (params.action !== undefined && params.action !== '') {
    search.set('action', params.action);
  }

  if (params.actorUserId !== undefined && params.actorUserId !== '') {
    search.set('actorUserId', params.actorUserId);
  }

  if (params.entityType !== undefined && params.entityType !== '') {
    search.set('entityType', params.entityType);
  }

  if (params.from !== undefined && params.from !== '') {
    search.set('from', params.from);
  }

  if (params.to !== undefined && params.to !== '') {
    search.set('to', params.to);
  }

  return search;
}

/** The audit log of the depot of the caller. Owner only. */
export function listAuditLog(params: ListAuditLogParams = {}): Promise<Paginated<AuditLogEntry>> {
  return apiRequest<Paginated<AuditLogEntry>>(withSearch('/audit-log', auditLogParams(params)));
}

/** The entries of the audit log of the platform. Platform Admin only. */
export function listPlatformAuditLog(
  params: ListAuditLogParams = {},
): Promise<Paginated<AuditLogEntry>> {
  return apiRequest<Paginated<AuditLogEntry>>(
    withSearch('/platform/audit-log', auditLogParams(params)),
  );
}

export { ApiError };
