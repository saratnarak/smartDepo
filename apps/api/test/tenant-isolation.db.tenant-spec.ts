import type { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import { TenantContext } from '../src/common/tenant/tenant-context.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setPlatformAdminSession, setTenantSession } from '../src/prisma/tenant-session.js';
import { createTestPrismaClient, getTestDatabaseUrl } from './support/test-database.js';

/**
 * Database-backed tenant isolation tests. They run against smartdepo_test only (guarded by
 * getTestDatabaseUrl) after `pnpm --filter api test:tenant` prepares the schema.
 *
 * The point of these tests is to prove RLS works on its own, without the Prisma tenant extension:
 * the base client talks to the app role with no extension, so the only thing stopping depot A from
 * touching depot B rows is the row-level security policy plus the app.depot_id session variable.
 */
describe('Tenant isolation with row-level security', () => {
  const runId = Date.now().toString(36);

  let base: PrismaClient;
  let service: PrismaService;
  let depotAId: string;
  let depotBId: string;
  let customerAId: string;
  let customerBId: string;
  let contextA: TenantContext;

  async function createWithSession<T>(
    depotId: string,
    work: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return base.$transaction(async (transaction) => {
      await setTenantSession(transaction, depotId);
      return work(transaction);
    });
  }

  beforeAll(async () => {
    // PrismaService reads DATABASE_URL; point it at the guarded test database for this suite.
    process.env.DATABASE_URL = getTestDatabaseUrl();
    base = createTestPrismaClient();
    service = new PrismaService();

    // Depots now have RLS too, so test fixtures are created through the explicit platform-admin
    // session rather than the unauthenticated base client.
    const fixtures = await base.$transaction(async (transaction) => {
      await setPlatformAdminSession(transaction);
      const depotA = await transaction.depot.create({
        data: {
          name: 'RLS Depot A',
          slug: `rls-depot-a-${runId}`,
          phone: '010000001',
          email: `rls-depot-a-${runId}@example.com`,
        },
      });
      const depotB = await transaction.depot.create({
        data: {
          name: 'RLS Depot B',
          slug: `rls-depot-b-${runId}`,
          phone: '010000002',
          email: `rls-depot-b-${runId}@example.com`,
        },
      });

      return { depotA, depotB };
    });

    depotAId = fixtures.depotA.id;
    depotBId = fixtures.depotB.id;
    contextA = TenantContext.fromPrincipal({
      userId: 'user-a',
      role: 'OWNER',
      depotId: depotAId,
    });

    customerAId = await createWithSession(depotAId, async (transaction) => {
      const customer = await transaction.customer.create({
        data: { depotId: depotAId, name: 'Customer A' },
      });
      return customer.id;
    });
    customerBId = await createWithSession(depotBId, async (transaction) => {
      const customer = await transaction.customer.create({
        data: { depotId: depotBId, name: 'Customer B' },
      });
      return customer.id;
    });
  });

  afterAll(async () => {
    // Clean up as the platform-admin path so the next run (which also truncates) stays tidy.
    await base.$transaction(async (transaction) => {
      await setPlatformAdminSession(transaction);
      await transaction.customer.deleteMany({
        where: { depotId: { in: [depotAId, depotBId] } },
      });
      await transaction.depot.deleteMany({ where: { id: { in: [depotAId, depotBId] } } });
    });

    await base.$disconnect();
    await service.onModuleDestroy();
  });

  it('denies all rows when no tenant session is set (fails closed)', async () => {
    await expect(base.customer.count()).resolves.toBe(0);
    await expect(base.customer.findMany()).resolves.toEqual([]);
  });

  it('without the extension, RLS blocks depot A from reading, updating, and deleting depot B', async () => {
    await base.$transaction(async (transaction) => {
      await setTenantSession(transaction, depotAId);

      const otherRows = await transaction.customer.findMany({ where: { id: customerBId } });
      expect(otherRows).toHaveLength(0);

      const updated = await transaction.customer.updateMany({
        where: { id: customerBId },
        data: { name: 'hacked by depot A' },
      });
      expect(updated.count).toBe(0);

      const deleted = await transaction.customer.deleteMany({ where: { id: customerBId } });
      expect(deleted.count).toBe(0);

      // Depot A still sees exactly its own row.
      const ownRows = await transaction.customer.findMany();
      expect(ownRows).toHaveLength(1);
      expect(ownRows[0]?.id).toBe(customerAId);
    });
  });

  it('without the extension, updating a depot B row by id throws instead of succeeding', async () => {
    await expect(
      base.$transaction(async (transaction) => {
        await setTenantSession(transaction, depotAId);
        return transaction.customer.update({
          where: { id: customerBId },
          data: { name: 'hacked by depot A' },
        });
      }),
    ).rejects.toThrow();
  });

  it('with the tenant extension, depot A cannot read, update, or delete depot B rows', async () => {
    await service.runAsTenant(contextA, async (client) => {
      expect(await client.customer.findUnique({ where: { id: customerBId } })).toBeNull();

      const updated = await client.customer.updateMany({
        where: { id: customerBId },
        data: { name: 'hacked by depot A' },
      });
      expect(updated.count).toBe(0);

      const deleted = await client.customer.deleteMany({ where: { id: customerBId } });
      expect(deleted.count).toBe(0);

      const own = await client.customer.findUnique({ where: { id: customerAId } });
      expect(own?.name).toBe('Customer A');
    });
  });

  it('leaves depot B rows unchanged after the cross-tenant attempts', async () => {
    await service.runAsPlatformAdmin(
      { userId: 'admin-1', role: 'PLATFORM_ADMIN' },
      async (client) => {
        const depotBCustomer = await client.customer.findUnique({ where: { id: customerBId } });
        expect(depotBCustomer?.name).toBe('Customer B');

        const both = await client.customer.findMany({
          where: { id: { in: [customerAId, customerBId] } },
        });
        expect(both).toHaveLength(2);
      },
    );
  });
});
