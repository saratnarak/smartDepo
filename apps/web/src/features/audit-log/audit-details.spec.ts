import { auditValueRows, formatValue } from './audit-details';

describe('the details of an audit entry', () => {
  it('shows the keys and the values of an object', () => {
    const rows = auditValueRows({ name: 'ABC Beer', amount: '12.50', isActive: true });

    expect(rows).toEqual([
      { key: 'name', value: 'ABC Beer', children: null },
      { key: 'amount', value: '12.50', children: null },
      { key: 'isActive', value: 'true', children: null },
    ]);
  });

  it('shows the children of a nested object', () => {
    const rows = auditValueRows({ owner: { id: 'u1', name: 'Sokha' } });

    expect(rows[0]?.key).toBe('owner');
    expect(rows[0]?.value).toBeNull();
    expect(rows[0]?.children).toEqual([
      { key: 'id', value: 'u1', children: null },
      { key: 'name', value: 'Sokha', children: null },
    ]);
  });

  it('shows the items of a list with a number', () => {
    const rows = auditValueRows(['first', 'second']);

    expect(rows).toEqual([
      { key: '1', value: 'first', children: null },
      { key: '2', value: 'second', children: null },
    ]);
  });

  it('has no rows for an empty value', () => {
    expect(auditValueRows(null)).toEqual([]);
    expect(auditValueRows(undefined)).toEqual([]);
    expect(auditValueRows({})).toEqual([]);
  });

  it('shows a missing value as a dash', () => {
    expect(formatValue(null)).toBe('—');
    expect(formatValue(undefined)).toBe('—');
    expect(formatValue('text')).toBe('text');
    expect(formatValue(12)).toBe('12');
    expect(formatValue(false)).toBe('false');
  });
});
