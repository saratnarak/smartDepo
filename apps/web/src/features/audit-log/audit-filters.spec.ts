import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  EMPTY_AUDIT_FILTERS,
  depotDayEnd,
  depotDayStart,
  filtersToParams,
  hasActiveFilters,
  hasInvalidPeriod,
} from './audit-filters';

describe('the filters of the audit log', () => {
  it('starts without a filter', () => {
    expect(EMPTY_AUDIT_FILTERS).toEqual({
      action: '',
      actorUserId: '',
      entityType: '',
      from: '',
      to: '',
    });
    expect(hasActiveFilters(EMPTY_AUDIT_FILTERS)).toBe(false);
    expect(filtersToParams(EMPTY_AUDIT_FILTERS)).toEqual({});
  });

  it('sends only the filters that are set', () => {
    const params = filtersToParams({
      action: 'STAFF_CREATED',
      actorUserId: '',
      entityType: 'User',
      from: '2026-10-01',
      to: '',
    });

    expect(params).toEqual({
      action: 'STAFF_CREATED',
      entityType: 'User',
      from: '2026-10-01T00:00:00+07:00',
    });
  });

  it('sends the whole day of the period, in the time of the depot', () => {
    expect(depotDayStart('2026-10-01')).toBe('2026-10-01T00:00:00+07:00');
    expect(depotDayEnd('2026-10-01')).toBe('2026-10-01T23:59:59.999+07:00');

    const params = filtersToParams({
      ...EMPTY_AUDIT_FILTERS,
      from: '2026-10-01',
      to: '2026-10-31',
    });

    expect(params.from).toBe('2026-10-01T00:00:00+07:00');
    expect(params.to).toBe('2026-10-31T23:59:59.999+07:00');
  });

  it('knows when a filter is set', () => {
    expect(hasActiveFilters({ ...EMPTY_AUDIT_FILTERS, action: 'USER_LOGIN' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_AUDIT_FILTERS, actorUserId: 'user-1' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_AUDIT_FILTERS, entityType: 'Depot' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_AUDIT_FILTERS, from: '2026-10-01' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_AUDIT_FILTERS, to: '2026-10-31' })).toBe(true);
  });

  it('refuses a period where the first day is after the last day', () => {
    expect(hasInvalidPeriod({ ...EMPTY_AUDIT_FILTERS, from: '2026-10-01', to: '2026-10-31' })).toBe(
      false,
    );
    expect(hasInvalidPeriod({ ...EMPTY_AUDIT_FILTERS, from: '2026-11-01', to: '2026-10-31' })).toBe(
      true,
    );
    expect(hasInvalidPeriod({ ...EMPTY_AUDIT_FILTERS, from: '2026-11-01' })).toBe(false);
  });

  it('knows the actions and the record types of the API', () => {
    expect(AUDIT_ACTIONS).toContain('DEPOT_PLAN_CHANGED');
    expect(AUDIT_ACTIONS).toContain('USER_LOGIN');
    expect(AUDIT_ENTITY_TYPES).toContain('Depot');
    expect(AUDIT_ENTITY_TYPES).toContain('SalesOrder');
  });
});
