import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { jest } from '@jest/globals';

import type { AuthenticatedPrincipal } from '../src/common/tenant/tenant-context.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import type { CreateStaffDto } from '../src/modules/users/dto/create-staff.dto.js';
import type { UpdateStaffDto } from '../src/modules/users/dto/update-staff.dto.js';
import { UsersService } from '../src/modules/users/users.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const DEPOT_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_ID = '33333333-3333-4333-8333-333333333333';

const OWNER: AuthenticatedPrincipal = { userId: OWNER_ID, role: 'OWNER', depotId: DEPOT_ID };

const STAFF_ROW = {
  id: STAFF_ID,
  name: 'Sokha Sales',
  email: 'sokha@example.com',
  phone: '012345678',
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  role: { code: 'SALES' },
};

function createService(): {
  service: UsersService;
  prisma: Record<string, jest.Mock>;
  transaction: Record<string, Record<string, jest.Mock>>;
  passwords: Record<string, jest.Mock>;
} {
  const transaction: Record<string, Record<string, jest.Mock>> = {
    role: { findUnique: jest.fn().mockResolvedValue({ id: 'sales-role-id' }) },
    user: {
      create: jest.fn().mockResolvedValue(STAFF_ROW),
      findFirst: jest.fn().mockResolvedValue(STAFF_ROW),
      findMany: jest.fn().mockResolvedValue([STAFF_ROW]),
      update: jest.fn().mockResolvedValue(STAFF_ROW),
      count: jest.fn().mockResolvedValue(1),
    },
    subscription: { findFirst: jest.fn().mockResolvedValue(null) },
    auditLog: { create: jest.fn() },
  };
  const passwords: Record<string, jest.Mock> = {
    hash: jest.fn().mockResolvedValue('new-hash'),
    verify: jest.fn(),
  };
  const prisma: Record<string, jest.Mock> = {
    runAsTenant: jest.fn().mockImplementation(async (_context, work) => work(transaction)),
  };

  return {
    service: new UsersService(
      prisma as unknown as PrismaService,
      passwords as unknown as PasswordService,
    ),
    prisma,
    transaction,
    passwords,
  };
}

const createDto: CreateStaffDto = {
  name: 'Sokha Sales',
  email: 'sokha@example.com',
  phone: '012345678',
  role: 'SALES',
  password: 'Password1',
};

describe('UsersService', () => {
  it('creates a staff account inside the token depot and writes an audit entry', async () => {
    const { service, transaction, passwords } = createService();

    const result = await service.create(OWNER, createDto);

    expect(passwords.hash).toHaveBeenCalledWith('Password1');
    expect(transaction.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          depotId: DEPOT_ID,
          roleId: 'sales-role-id',
          email: 'sokha@example.com',
          passwordHash: 'new-hash',
        }),
      }),
    );
    expect(result).toMatchObject({ id: STAFF_ID, role: 'SALES', isActive: true });

    const audit = transaction.auditLog.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(audit.data).toMatchObject({
      action: 'STAFF_CREATED',
      entityType: 'User',
      actorUserId: OWNER_ID,
    });
    expect(JSON.stringify(audit.data)).not.toContain('new-hash');
  });

  it('creates a staff account when the depot has no active subscription', async () => {
    const { service, transaction } = createService();

    await service.create(OWNER, createDto);

    expect(transaction.subscription.findFirst).toHaveBeenCalled();
    expect(transaction.user.create).toHaveBeenCalled();
  });

  it('refuses to create staff when the plan user limit is reached', async () => {
    const { service, transaction } = createService();
    transaction.subscription.findFirst.mockResolvedValue({
      plan: { maxUsers: 1 },
    });
    transaction.user.count.mockResolvedValue(1);

    await expect(service.create(OWNER, createDto)).rejects.toMatchObject({
      response: {
        message: expect.stringContaining('allows at most 1 active user'),
        details: { reason: 'PLAN_USER_LIMIT_REACHED', maxUsers: 1, activeUsers: 1 },
      },
    });
    expect(transaction.user.create).not.toHaveBeenCalled();
  });

  it('allows creation below the plan limit', async () => {
    const { service, transaction } = createService();
    transaction.subscription.findFirst.mockResolvedValue({ plan: { maxUsers: 5 } });
    transaction.user.count.mockResolvedValue(2);

    await expect(service.create(OWNER, createDto)).resolves.toMatchObject({ id: STAFF_ID });
  });

  it('maps a duplicate email or phone to 409', async () => {
    const { service, transaction } = createService();
    transaction.user.create.mockRejectedValue({ code: 'P2002' });

    await expect(service.create(OWNER, createDto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists only staff roles of the caller depot with pagination', async () => {
    const { service, transaction } = createService();

    const result = await service.list(OWNER, {
      page: 2,
      pageSize: 5,
      sort: 'createdAt',
      order: 'desc',
    });

    expect(transaction.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: { code: { in: ['SALES', 'STOCK_KEEPER', 'DELIVERY'] } } },
        skip: 5,
        take: 5,
      }),
    );
    expect(result.meta).toEqual({ page: 2, pageSize: 5, total: 1 });
  });

  it('rejects an empty update', async () => {
    const { service } = createService();

    await expect(service.update(OWNER, STAFF_ID, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns not found for a staff id outside the caller depot', async () => {
    const { service, transaction } = createService();
    transaction.user.findFirst.mockResolvedValue(null);

    await expect(
      service.update(OWNER, STAFF_ID, { name: 'Other Depot Staff' } satisfies UpdateStaffDto),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not manage an owner or platform admin account as staff', async () => {
    const { service, transaction } = createService();
    transaction.user.findFirst.mockResolvedValue({ ...STAFF_ROW, role: { code: 'OWNER' } });

    await expect(service.deactivate(OWNER, STAFF_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses self-deactivation', async () => {
    const { service, transaction } = createService();
    transaction.user.findFirst.mockResolvedValue({ ...STAFF_ROW, id: OWNER_ID });

    await expect(service.deactivate(OWNER, OWNER_ID)).rejects.toThrow(
      'You cannot deactivate your own account',
    );
    expect(transaction.user.update).not.toHaveBeenCalled();
  });

  it('deactivates a staff account and audits it', async () => {
    const { service, transaction } = createService();
    const inactive = { ...STAFF_ROW, isActive: false };
    transaction.user.update.mockResolvedValue(inactive);

    const result = await service.deactivate(OWNER, STAFF_ID);

    expect(result.isActive).toBe(false);
    expect(transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: STAFF_ID }, data: { isActive: false } }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'STAFF_DEACTIVATED' }),
      }),
    );
  });

  it('resets a staff password with must_change_password and never audits the password', async () => {
    const { service, transaction, passwords } = createService();
    transaction.user.update.mockResolvedValue({
      id: STAFF_ID,
      mustChangePassword: true,
    });

    const result = await service.resetPassword(OWNER, STAFF_ID, { newPassword: 'Temporary2' });

    expect(passwords.hash).toHaveBeenCalledWith('Temporary2');
    expect(transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: 'new-hash',
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      }),
    );
    expect(result).toEqual({ id: STAFF_ID, mustChangePassword: true });

    const audit = transaction.auditLog.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(audit.data).toMatchObject({ action: 'PASSWORD_RESET' });
    expect(JSON.stringify(audit.data)).not.toContain('new-hash');
    expect(JSON.stringify(audit.data)).not.toContain('Temporary2');
  });

  it('enforces the plan limit when reactivating an inactive staff member', async () => {
    const { service, transaction } = createService();
    transaction.user.findFirst.mockResolvedValue({ ...STAFF_ROW, isActive: false });
    transaction.subscription.findFirst.mockResolvedValue({ plan: { maxUsers: 2 } });
    transaction.user.count.mockResolvedValue(2);

    await expect(service.update(OWNER, STAFF_ID, { isActive: true })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction.user.update).not.toHaveBeenCalled();
  });
});
