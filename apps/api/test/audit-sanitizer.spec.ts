import { sanitizeAuditJson, sanitizeAuditValue } from '../src/modules/audit-log/audit-sanitizer.js';

describe('the cleaner of the audit log', () => {
  it('keeps the readable values', () => {
    const cleaned = sanitizeAuditJson({
      name: 'ABC Beer',
      amount: '12.50',
      isActive: true,
    });

    expect(cleaned).toEqual({ name: 'ABC Beer', amount: '12.50', isActive: true });
  });

  it('removes a password hash', () => {
    const cleaned = sanitizeAuditJson({
      email: 'owner@example.com',
      passwordHash: '$2b$10$secret',
    });

    expect(cleaned).toEqual({ email: 'owner@example.com' });
  });

  it('removes the keys that look like a secret', () => {
    const cleaned = sanitizeAuditJson({
      refreshToken: 'token-value',
      accessToken: 'token-value',
      apiKey: 'key',
      secretAccessKey: 'key',
      authorization: 'Bearer token',
      cookie: 'session=1',
      jwt: 'token',
      privateKey: 'key',
      credential: 'value',
      signature: 'value',
      name: 'Sokha',
    });

    expect(cleaned).toEqual({ name: 'Sokha' });
  });

  it('removes the secret keys of the nested values', () => {
    const cleaned = sanitizeAuditJson({
      owner: { name: 'Sokha', passwordHash: '$2b$10$secret' },
      lines: [{ sku: 'BEER-1', token: 'secret' }],
    });

    expect(cleaned).toEqual({
      owner: { name: 'Sokha' },
      lines: [{ sku: 'BEER-1' }],
    });
  });

  it('keeps the values that are not objects', () => {
    expect(sanitizeAuditJson(null)).toBeNull();
    expect(sanitizeAuditJson('text')).toBe('text');
    expect(sanitizeAuditJson(42)).toBe(42);
    expect(sanitizeAuditJson([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('lists the keys that were removed', () => {
    const result = sanitizeAuditValue({
      name: 'Sokha',
      passwordHash: 'hash',
      nested: { token: 'token' },
    });

    expect(result.removedKeys).toEqual(['passwordHash', 'nested.token']);
  });
});
