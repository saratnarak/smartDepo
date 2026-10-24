import type { ListAuditLogParams } from '@/lib/api-client';
import { DEPOT_UTC_OFFSET_MINUTES } from '@/lib/depot-dates';

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

/** The time of the depot as a time zone of an ISO date-time, for example +07:00. */
function depotOffsetSuffix(): string {
  const sign = DEPOT_UTC_OFFSET_MINUTES < 0 ? '-' : '+';
  const absolute = Math.abs(DEPOT_UTC_OFFSET_MINUTES);

  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

/**
 * The first moment of a day of the depot, as an ISO date-time. The API compares the entries with
 * `createdAt >= from`, so a day without its time would cut the morning of the chosen day.
 */
export function depotDayStart(day: string): string {
  return `${day}T00:00:00${depotOffsetSuffix()}`;
}

/**
 * The last moment of a day of the depot, as an ISO date-time. The API compares the entries with
 * `createdAt <= to`, so the day has to end at 23:59:59.999 to keep the whole day.
 */
export function depotDayEnd(day: string): string {
  return `${day}T23:59:59.999${depotOffsetSuffix()}`;
}

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
    params.from = depotDayStart(filters.from);
  }

  if (filters.to !== '') {
    params.to = depotDayEnd(filters.to);
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
