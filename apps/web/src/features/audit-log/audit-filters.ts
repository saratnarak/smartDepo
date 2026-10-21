import type { ListAuditLogParams } from '@/lib/api-client';

/**
 * The filters of the audit log (FR-51). The lists of the actions and of the types of record are
 * the names the API uses, so the filter sends exactly what the API expects.
 */

export const AUDIT_ACTIONS = [
  'DEPOT_REGISTERED',
  'DEPOT_APPROVED',
  'DEPOT_REJECTED',
  'DEPOT_SUSPENDED',
  'DEPOT_SETTINGS_UPDATED',
  'DEPOT_PLAN_CHANGED',
  'DEPOT_LOGO_UPDATED',
  'STAFF_CREATED',
  'STAFF_UPDATED',
  'STAFF_DEACTIVATED',
  'CATEGORY_CREATED',
  'CATEGORY_UPDATED',
  'CATEGORY_ARCHIVED',
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'PRODUCT_ARCHIVED',
  'PRODUCT_UNIT_CREATED',
  'PRODUCT_UNIT_UPDATED',
  'PRODUCT_UNIT_ARCHIVED',
  'PRODUCT_IMAGE_UPDATED',
  'PRICE_CHANGED',
  'STOCK_ADJUSTED',
  'STOCK_DAMAGE_RECORDED',
  'SUPPLIER_CREATED',
  'SUPPLIER_UPDATED',
  'SUPPLIER_ARCHIVED',
  'PURCHASE_CREATED',
  'PURCHASE_UPDATED',
  'PURCHASE_RECEIVED',
  'PURCHASE_CANCELLED',
  'CUSTOMER_CREATED',
  'CUSTOMER_UPDATED',
  'CUSTOMER_ARCHIVED',
  'INVOICE_CREATED',
  'INVOICE_VOIDED',
  'PAYMENT_RECORDED',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET',
  'USER_LOGIN',
] as const;

export const AUDIT_ENTITY_TYPES = [
  'Depot',
  'User',
  'Category',
  'Product',
  'ProductUnit',
  'Price',
  'Supplier',
  'PurchaseOrder',
  'Customer',
  'SalesOrder',
  'Payment',
  'StockMovement',
  'Batch',
] as const;

export interface AuditFilters {
  action: string;
  actorUserId: string;
  entityType: string;
  from: string;
  to: string;
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  action: '',
  actorUserId: '',
  entityType: '',
  from: '',
  to: '',
};

/** The filters without the empty values, so the API only gets what the user picked. */
export function filtersToParams(filters: AuditFilters): ListAuditLogParams {
  const params: ListAuditLogParams = {};

  if (filters.action !== '') {
    params.action = filters.action;
  }

  if (filters.actorUserId !== '') {
    params.actorUserId = filters.actorUserId;
  }

  if (filters.entityType !== '') {
    params.entityType = filters.entityType;
  }

  if (filters.from !== '') {
    params.from = filters.from;
  }

  if (filters.to !== '') {
    params.to = filters.to;
  }

  return params;
}

/** True when at least one filter is set. */
export function hasActiveFilters(filters: AuditFilters): boolean {
  return (
    filters.action !== '' ||
    filters.actorUserId !== '' ||
    filters.entityType !== '' ||
    filters.from !== '' ||
    filters.to !== ''
  );
}

/** True when the period of the filters is not a real period. */
export function hasInvalidPeriod(filters: AuditFilters): boolean {
  if (filters.from === '' || filters.to === '') {
    return false;
  }

  return filters.from > filters.to;
}
