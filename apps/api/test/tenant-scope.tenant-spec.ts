import { ForbiddenException } from '@nestjs/common';

import { assertPlatformAdmin, TenantContext } from '../src/common/tenant/tenant-context.js';
import type { UserRole } from '../src/common/tenant/tenant-context.js';
import { isDepotScopedModel } from '../src/common/tenant/tenant-models.js';
import { scopeQueryArgs } from '../src/common/tenant/tenant-scope.js';

const DEPOT_A = '11111111-1111-4111-8111-111111111111';
const DEPOT_B = '22222222-2222-4222-8222-222222222222';

describe('TenantContext', () => {
  it('builds the scope from token claims', () => {
    const context = TenantContext.fromPrincipal({
      userId: 'user-1',
      role: 'SALES',
      depotId: DEPOT_A,
    });

    expect(context.depotId).toBe(DEPOT_A);
    expect(context.role).toBe('SALES');
    expect(context.userId).toBe('user-1');
  });

  it('rejects a principal without a depot', () => {
    expect(() =>
      TenantContext.fromPrincipal({ userId: 'user-1', role: 'OWNER', depotId: null }),
    ).toThrow(ForbiddenException);
  });

  it('rejects a platform admin on the tenant path', () => {
    expect(() =>
      TenantContext.fromPrincipal({ userId: 'admin-1', role: 'PLATFORM_ADMIN', depotId: DEPOT_A }),
    ).toThrow(ForbiddenException);
  });

  it('rejects an unknown role at runtime', () => {
    expect(() =>
      TenantContext.fromPrincipal({
        userId: 'user-1',
        role: 'GHOST' as UserRole,
        depotId: DEPOT_A,
      }),
    ).toThrow(ForbiddenException);
  });

  it('rejects a depot role on the platform admin path', () => {
    expect(() =>
      assertPlatformAdmin({ userId: 'user-1', role: 'OWNER', depotId: DEPOT_A }),
    ).toThrow(ForbiddenException);
  });
});

describe('scopeQueryArgs', () => {
  it('adds the token depot to findMany filters', () => {
    const args = scopeQueryArgs('findMany', { where: { isActive: true } }, DEPOT_A);

    expect(args).toEqual({ where: { isActive: true, depotId: DEPOT_A } });
  });

  it('rejects a depot B filter from a depot A user', () => {
    expect(() => scopeQueryArgs('findMany', { where: { depotId: DEPOT_B } }, DEPOT_A)).toThrow(
      ForbiddenException,
    );
  });

  it('looks records up by id and depot id', () => {
    const args = scopeQueryArgs(
      'findUnique',
      { where: { id: 'record-1', depotId: DEPOT_A } },
      DEPOT_A,
    );

    expect(args).toEqual({ where: { id: 'record-1', depotId: DEPOT_A } });
  });

  it('stamps the depot on create data', () => {
    const args = scopeQueryArgs('create', { data: { name: 'Customer A' } }, DEPOT_A);

    expect(args).toEqual({ data: { name: 'Customer A', depotId: DEPOT_A } });
  });

  it('rejects creating a row for another depot', () => {
    expect(() =>
      scopeQueryArgs('create', { data: { name: 'Customer B', depotId: DEPOT_B } }, DEPOT_A),
    ).toThrow(ForbiddenException);
  });

  it('stamps the depot on every createMany row', () => {
    const args = scopeQueryArgs(
      'createMany',
      { data: [{ name: 'Customer A' }, { name: 'Customer B' }] },
      DEPOT_A,
    );

    expect(args).toEqual({
      data: [
        { name: 'Customer A', depotId: DEPOT_A },
        { name: 'Customer B', depotId: DEPOT_A },
      ],
    });
  });

  it('scopes updates and rejects a depot change', () => {
    const args = scopeQueryArgs(
      'update',
      { where: { id: 'record-1' }, data: { name: 'Renamed' } },
      DEPOT_A,
    );
    expect(args).toEqual({
      where: { id: 'record-1', depotId: DEPOT_A },
      data: { name: 'Renamed' },
    });

    expect(() =>
      scopeQueryArgs('update', { where: { id: 'record-1' }, data: { depotId: DEPOT_B } }, DEPOT_A),
    ).toThrow(ForbiddenException);
  });

  it('scopes deletes', () => {
    const args = scopeQueryArgs('delete', { where: { id: 'record-1' } }, DEPOT_A);

    expect(args).toEqual({ where: { id: 'record-1', depotId: DEPOT_A } });
  });

  it('scopes both sides of an upsert', () => {
    const args = scopeQueryArgs(
      'upsert',
      {
        where: { id: 'record-1' },
        create: { name: 'New row' },
        update: { name: 'Updated row' },
      },
      DEPOT_A,
    );

    expect(args).toEqual({
      where: { id: 'record-1', depotId: DEPOT_A },
      create: { name: 'New row', depotId: DEPOT_A },
      update: { name: 'Updated row' },
    });
  });

  it('scopes count, aggregate and groupBy', () => {
    for (const operation of ['count', 'aggregate', 'groupBy']) {
      const args = scopeQueryArgs(operation, {}, DEPOT_A);

      expect(args).toEqual({ where: { depotId: DEPOT_A } });
    }
  });

  it('scopes deleteMany without a where clause', () => {
    const args = scopeQueryArgs('deleteMany', {}, DEPOT_A);

    expect(args).toEqual({ where: { depotId: DEPOT_A } });
  });

  it('fails closed on an unknown operation', () => {
    expect(() => scopeQueryArgs('executeRaw', { where: {} }, DEPOT_A)).toThrow(
      'Unsupported tenant-scoped Prisma operation',
    );
  });

  it('requires a non-empty depot id', () => {
    expect(() => scopeQueryArgs('findMany', {}, '  ')).toThrow(ForbiddenException);
  });

  it('scopes depot-owned models and leaves platform models alone', () => {
    expect(isDepotScopedModel('Customer')).toBe(true);
    expect(isDepotScopedModel('PaymentAllocation')).toBe(true);
    expect(isDepotScopedModel('User')).toBe(true);
    expect(isDepotScopedModel('Depot')).toBe(false);
    expect(isDepotScopedModel('Plan')).toBe(false);
    expect(isDepotScopedModel('Role')).toBe(false);
  });
});
