import { BadRequestException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';

import type { AuthenticatedPrincipal } from '../src/common/tenant/tenant-context.js';
import { DepotSettingsService } from '../src/modules/depots/depot-settings.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const DEPOT_ID = '22222222-2222-4222-8222-222222222222';

const OWNER: AuthenticatedPrincipal = { userId: OWNER_ID, role: 'OWNER', depotId: DEPOT_ID };

const SETTINGS = {
  id: DEPOT_ID,
  name: 'Depot A',
  address: null as string | null,
  currency: 'KHR',
  locale: 'EN',
  invoiceFooter: null as string | null,
};

function createService(): {
  service: DepotSettingsService;
  prisma: Record<string, jest.Mock>;
  transaction: Record<string, Record<string, jest.Mock>>;
} {
  const transaction: Record<string, Record<string, jest.Mock>> = {
    depot: {
      findUnique: jest.fn().mockResolvedValue(SETTINGS),
      update: jest.fn().mockResolvedValue({ ...SETTINGS, name: 'Depot A Updated' }),
    },
    auditLog: { create: jest.fn() },
  };
  const prisma: Record<string, jest.Mock> = {
    runAsTenant: jest.fn().mockImplementation(async (_context, work) => work(transaction)),
  };

  return {
    service: new DepotSettingsService(prisma as unknown as PrismaService),
    prisma,
    transaction,
  };
}

describe('DepotSettingsService', () => {
  it('reads settings for the depot in the token, not a request id', async () => {
    const { service, prisma, transaction } = createService();

    const result = await service.get(OWNER);

    expect(prisma.runAsTenant).toHaveBeenCalledWith(
      expect.objectContaining({ depotId: DEPOT_ID }),
      expect.any(Function),
    );
    expect(transaction.depot.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: DEPOT_ID } }),
    );
    expect(result).toEqual(SETTINGS);
  });

  it('rejects an empty settings update', async () => {
    const { service } = createService();

    await expect(service.update(OWNER, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates settings and writes a before/after audit entry', async () => {
    const { service, transaction } = createService();

    const result = await service.update(OWNER, {
      name: 'Depot A Updated',
      currency: 'USD',
      locale: 'KM',
    });

    expect(transaction.depot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DEPOT_ID },
        data: { name: 'Depot A Updated', currency: 'USD', locale: 'KM' },
      }),
    );
    expect(result.name).toBe('Depot A Updated');
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'DEPOT_SETTINGS_UPDATED',
          entityType: 'Depot',
          entityId: DEPOT_ID,
          before: SETTINGS,
          after: expect.objectContaining({ name: 'Depot A Updated' }),
        }),
      }),
    );
  });

  it('returns not found when the depot row is missing', async () => {
    const { service, transaction } = createService();
    transaction.depot.findUnique.mockResolvedValue(null);

    await expect(service.get(OWNER)).rejects.toBeInstanceOf(NotFoundException);
  });
});
