import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { jest } from '@jest/globals';

import { AuthService } from '../src/modules/auth/auth.service.js';
import type { PasswordService } from '../src/modules/auth/password.service.js';
import type { TokenService } from '../src/modules/auth/token.service.js';
import type { AuthUserRecord } from '../src/prisma/auth-repository.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

const USER: AuthUserRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  depotId: '22222222-2222-4222-8222-222222222222',
  roleCode: 'OWNER',
  name: 'Owner',
  email: 'owner@example.com',
  phone: '012345678',
  passwordHash: 'stored-hash',
  isActive: true,
  mustChangePassword: false,
  failedLoginAttempts: 0,
  lockedUntil: null,
  depotStatus: 'APPROVED',
  depotName: 'Depot A',
};

const TOKEN_PAIR = {
  accessToken: 'access',
  refreshToken: 'refresh',
  tokenType: 'Bearer' as const,
  expiresIn: '15m',
};

function createService(): {
  service: AuthService;
  prisma: Record<string, jest.Mock>;
  passwords: Record<string, jest.Mock>;
  tokens: Record<string, jest.Mock>;
} {
  const prisma: Record<string, jest.Mock> = {
    authFindUser: jest.fn(),
    authGetUser: jest.fn(),
    recordLoginFailure: jest.fn(),
    recordLoginSuccess: jest.fn(),
    runAsTenant: jest.fn(),
    runAsPlatformAdmin: jest.fn(),
    runForDepotRegistration: jest.fn(),
  };
  const passwords: Record<string, jest.Mock> = {
    hash: jest.fn(),
    verify: jest.fn(),
  };
  const tokens: Record<string, jest.Mock> = { issuePair: jest.fn() };

  return {
    service: new AuthService(
      prisma as unknown as PrismaService,
      passwords as unknown as PasswordService,
      tokens as unknown as TokenService,
    ),
    prisma,
    passwords,
    tokens,
  };
}

describe('AuthService', () => {
  it('rejects unknown credentials without revealing whether the user exists', async () => {
    const { service, prisma } = createService();
    prisma.authFindUser.mockResolvedValue(null);

    await expect(
      service.login({ identifier: 'nobody@example.com', password: 'Password1' }, null),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.recordLoginFailure).not.toHaveBeenCalled();
  });

  it('blocks a valid password when the depot is not approved and explains the status', async () => {
    const { service, prisma, passwords } = createService();
    prisma.authFindUser.mockResolvedValue({ ...USER, depotStatus: 'PENDING' });
    passwords.verify.mockResolvedValue(true);

    await expect(
      service.login({ identifier: USER.email, password: 'Password1' }, null),
    ).rejects.toMatchObject({
      response: { details: { reason: 'DEPOT_PENDING', depotStatus: 'PENDING' } },
    });
    expect(prisma.recordLoginSuccess).not.toHaveBeenCalled();
  });

  it('records a failed attempt and rejects a wrong password', async () => {
    const { service, prisma, passwords } = createService();
    prisma.authFindUser.mockResolvedValue(USER);
    passwords.verify.mockResolvedValue(false);

    await expect(
      service.login({ identifier: USER.email, password: 'WrongPassword1' }, null),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.recordLoginFailure).toHaveBeenCalledWith(
      USER.id,
      expect.any(Number),
      expect.any(Date),
    );
  });

  it('issues tokens and writes a login audit entry for an approved depot', async () => {
    const { service, prisma, passwords, tokens } = createService();
    const auditCreate = jest.fn();
    prisma.authFindUser.mockResolvedValue(USER);
    passwords.verify.mockResolvedValue(true);
    prisma.runAsTenant.mockImplementation(async (_context, work) =>
      work({ auditLog: { create: auditCreate } }),
    );
    tokens.issuePair.mockResolvedValue(TOKEN_PAIR);

    const result = await service.login(
      { identifier: USER.email, password: 'Password1' },
      '127.0.0.1',
    );

    expect(result.accessToken).toBe('access');
    expect(result.user).toMatchObject({
      id: USER.id,
      role: 'OWNER',
      depotId: USER.depotId,
      mustChangePassword: false,
    });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'USER_LOGIN' }) }),
    );
  });

  it('reports must_change_password after an owner password reset', async () => {
    const { service, prisma, passwords, tokens } = createService();
    prisma.authFindUser.mockResolvedValue({ ...USER, mustChangePassword: true });
    passwords.verify.mockResolvedValue(true);
    prisma.runAsTenant.mockImplementation(async (_context, work) =>
      work({ auditLog: { create: jest.fn() } }),
    );
    tokens.issuePair.mockResolvedValue(TOKEN_PAIR);

    const result = await service.login({ identifier: USER.email, password: 'Password1' }, null);

    expect(result.user.mustChangePassword).toBe(true);
  });

  it('changes the caller password after verifying the current one', async () => {
    const { service, prisma, passwords } = createService();
    const userUpdate = jest.fn();
    const auditCreate = jest.fn();
    prisma.authGetUser.mockResolvedValue(USER);
    passwords.verify.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    passwords.hash.mockResolvedValue('new-hash');
    prisma.runAsTenant.mockImplementation(async (_context, work) =>
      work({ user: { update: userUpdate }, auditLog: { create: auditCreate } }),
    );

    const result = await service.changePassword(
      { userId: USER.id, role: 'OWNER', depotId: USER.depotId },
      { currentPassword: 'CurrentPassword1', newPassword: 'NewPassword2' },
    );

    expect(result).toEqual({ mustChangePassword: false });
    expect(passwords.verify).toHaveBeenNthCalledWith(1, 'CurrentPassword1', USER.passwordHash);
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER.id },
        data: expect.objectContaining({
          passwordHash: 'new-hash',
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      }),
    );

    const audit = auditCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(audit.data).toMatchObject({ action: 'PASSWORD_CHANGED', entityId: USER.id });
    expect(JSON.stringify(audit.data)).not.toContain('new-hash');
    expect(JSON.stringify(audit.data)).not.toContain('NewPassword2');
  });

  it('rejects a wrong current password without updating anything', async () => {
    const { service, prisma, passwords } = createService();
    const userUpdate = jest.fn();
    prisma.authGetUser.mockResolvedValue(USER);
    passwords.verify.mockResolvedValue(false);
    prisma.runAsTenant.mockImplementation(async (_context, work) =>
      work({ user: { update: userUpdate }, auditLog: { create: jest.fn() } }),
    );

    await expect(
      service.changePassword(
        { userId: USER.id, role: 'OWNER', depotId: USER.depotId },
        { currentPassword: 'WrongPassword1', newPassword: 'NewPassword2' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('rejects a new password identical to the current one', async () => {
    const { service, prisma, passwords } = createService();
    prisma.authGetUser.mockResolvedValue(USER);
    passwords.verify.mockResolvedValue(true);

    await expect(
      service.changePassword(
        { userId: USER.id, role: 'OWNER', depotId: USER.depotId },
        { currentPassword: 'Password1', newPassword: 'Password1' },
      ),
    ).rejects.toThrow('New password must be different from the current password');
  });

  it('does not change a password when the token depot does not match the user', async () => {
    const { service, prisma } = createService();
    prisma.authGetUser.mockResolvedValue(USER);

    await expect(
      service.changePassword(
        { userId: USER.id, role: 'OWNER', depotId: '99999999-9999-4999-8999-999999999999' },
        { currentPassword: 'Password1', newPassword: 'NewPassword2' },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('registers a pending depot and its owner inside the dedicated registration path', async () => {
    const { service, prisma, passwords } = createService();
    const auditCreate = jest.fn();
    const subscriptionCreate = jest.fn();
    const transaction = {
      role: { findUnique: jest.fn().mockResolvedValue({ id: 'owner-role' }) },
      plan: { findFirst: jest.fn().mockResolvedValue({ id: 'free-trial-plan' }) },
      subscription: { create: subscriptionCreate },
      depot: {
        create: jest.fn().mockImplementation(({ data }) => ({ ...data })),
      },
      user: {
        create: jest.fn().mockResolvedValue({
          id: 'owner-id',
          name: 'Owner',
          email: 'owner@example.com',
          phone: '012345678',
        }),
      },
      auditLog: { create: auditCreate },
    };
    prisma.runForDepotRegistration.mockImplementation(async (_depotId, work) => work(transaction));
    passwords.hash.mockResolvedValue('hashed');

    const result = await service.register({
      depotName: 'New Depot',
      ownerName: 'Owner',
      phone: '012345678',
      email: 'Owner@Example.com',
      password: 'Password1',
    });

    expect(result.depot.status).toBe('PENDING');
    expect(transaction.depot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING', email: 'owner@example.com' }),
      }),
    );
    expect(subscriptionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ planId: 'free-trial-plan', status: 'ACTIVE' }),
      }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'DEPOT_REGISTERED' }) }),
    );
  });

  it('maps a unique email or phone conflict to 409', async () => {
    const { service, prisma, passwords } = createService();
    prisma.runForDepotRegistration.mockRejectedValue({ code: 'P2002' });
    passwords.hash.mockResolvedValue('hashed');

    await expect(
      service.register({
        depotName: 'New Depot',
        ownerName: 'Owner',
        phone: '012345678',
        email: 'owner@example.com',
        password: 'Password1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
