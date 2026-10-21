import { randomBytes, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

import { AUDIT_ACTIONS } from '../../common/audit/audit-actions.js';
import { FREE_TRIAL_PLAN_CODE } from '../../common/plans/plan-limits.js';
import { isUniqueConstraintError } from '../../common/prisma/prisma-errors.js';
import type { AuthenticatedPrincipal, UserRole } from '../../common/tenant/tenant-context.js';
import {
  isUserRole,
  PLATFORM_ADMIN_ROLE,
  TenantContext,
} from '../../common/tenant/tenant-context.js';
import type { DepotStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthUserRecord } from '../../prisma/auth-repository.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RefreshTokenDto } from './dto/refresh-token.dto.js';
import type { RegisterDepotDto } from './dto/register-depot.dto.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  depotId: string | null;
  mustChangePassword: boolean;
}

export interface SafeDepot {
  id: string;
  name: string;
  status: string;
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug === '' ? 'depot' : slug;
}

type LoginBlockReason =
  'DEPOT_PENDING' | 'DEPOT_REJECTED' | 'DEPOT_SUSPENDED' | 'ACCOUNT_UNAVAILABLE';

function invalidCredentials(
  reason?: LoginBlockReason,
  depotStatus?: DepotStatus | null,
): UnauthorizedException {
  return new UnauthorizedException({
    message: 'Invalid credentials',
    error: 'Unauthorized',
    ...(reason === undefined ? {} : { details: { reason, depotStatus: depotStatus ?? null } }),
  });
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDepotDto): Promise<{
    depot: SafeDepot;
    owner: { id: string; name: string; email: string; phone: string };
  }> {
    const depotId = randomUUID();
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone.trim();
    const passwordHash = await this.passwords.hash(dto.password);
    const slug = `${slugify(dto.depotName)}-${randomBytes(4).toString('hex')}`;

    try {
      return await this.prisma.runForDepotRegistration(depotId, async (transaction) => {
        const ownerRole = await transaction.role.findUnique({ where: { code: 'OWNER' } });

        if (ownerRole === null) {
          throw new InternalServerErrorException('OWNER role is not configured');
        }

        const depot = await transaction.depot.create({
          data: {
            id: depotId,
            name: dto.depotName,
            slug,
            phone,
            email,
            status: 'PENDING',
          },
        });
        const owner = await transaction.user.create({
          data: {
            depotId,
            roleId: ownerRole.id,
            name: dto.ownerName,
            email,
            phone,
            passwordHash,
          },
        });

        // Every new depot starts with the Free Trial plan (FR-4).
        const freeTrial = await transaction.plan.findFirst({
          where: { code: FREE_TRIAL_PLAN_CODE, isActive: true },
          select: { id: true },
        });

        if (freeTrial !== null) {
          await transaction.subscription.create({
            data: { depotId, planId: freeTrial.id, status: 'ACTIVE' },
          });
        }

        await transaction.auditLog.create({
          data: {
            depotId,
            actorUserId: owner.id,
            action: AUDIT_ACTIONS.DEPOT_REGISTERED,
            entityType: 'Depot',
            entityId: depotId,
            after: {
              status: depot.status,
              ownerEmail: owner.email,
              planCode: freeTrial === null ? null : FREE_TRIAL_PLAN_CODE,
            },
          },
        });

        return {
          depot: { id: depot.id, name: depot.name, status: depot.status },
          owner: {
            id: owner.id,
            name: owner.name,
            email: owner.email,
            phone: owner.phone ?? phone,
          },
        };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException({
          message: 'Email or phone is already registered',
          details: { reason: 'IDENTIFIER_TAKEN' },
        });
      }
      throw error;
    }
  }

  async login(
    dto: LoginDto,
    ipAddress: string | null,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    expiresIn: string;
    user: SafeUser;
    depot: SafeDepot | null;
  }> {
    const user = await this.prisma.authFindUser(dto.identifier.trim());

    if (user === null || !user.isActive) {
      throw invalidCredentials();
    }

    if (user.lockedUntil !== null && user.lockedUntil.getTime() > Date.now()) {
      throw invalidCredentials();
    }

    const passwordMatches = await this.passwords.verify(dto.password, user.passwordHash);

    if (!passwordMatches) {
      await this.prisma.recordLoginFailure(
        user.id,
        MAX_FAILED_LOGIN_ATTEMPTS,
        new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000),
      );
      throw invalidCredentials();
    }

    const blockReason = this.loginBlockReason(user);

    if (blockReason !== null) {
      throw invalidCredentials(blockReason, user.depotStatus);
    }

    await this.prisma.recordLoginSuccess(user.id);
    await this.writeLoginAudit(user, ipAddress);

    const role = this.toUserRole(user);
    const pair = await this.tokens.issuePair({
      id: user.id,
      role,
      depotId: user.depotId,
    });

    return {
      ...pair,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role,
        depotId: user.depotId,
        mustChangePassword: user.mustChangePassword,
      },
      depot:
        user.depotId === null
          ? null
          : {
              id: user.depotId,
              name: user.depotName ?? '',
              status: user.depotStatus ?? 'PENDING',
            },
    };
  }

  async refresh(dto: RefreshTokenDto): Promise<{
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    expiresIn: string;
  }> {
    const claims = await this.tokens.verifyRefreshToken(dto.refreshToken);
    const user = await this.prisma.authGetUser(claims.sub);

    if (user === null || !user.isActive) {
      throw invalidCredentials();
    }

    const blockReason = this.loginBlockReason(user);

    if (blockReason !== null) {
      throw invalidCredentials(blockReason, user.depotStatus);
    }

    return this.tokens.issuePair({
      id: user.id,
      role: this.toUserRole(user),
      depotId: user.depotId,
    });
  }

  async me(principal: AuthenticatedPrincipal): Promise<{
    user: SafeUser;
    depot: SafeDepot | null;
  }> {
    if (principal.role === PLATFORM_ADMIN_ROLE) {
      return this.prisma.runAsPlatformAdmin(principal, async (transaction) => {
        const user = await transaction.user.findUnique({ where: { id: principal.userId } });

        if (user === null) {
          throw invalidCredentials();
        }

        return {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: PLATFORM_ADMIN_ROLE,
            depotId: null,
            mustChangePassword: user.mustChangePassword,
          },
          depot: null,
        };
      });
    }

    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const user = await transaction.user.findUnique({ where: { id: principal.userId } });
      const depot = await transaction.depot.findUnique({ where: { id: context.depotId } });

      if (user === null || depot === null) {
        throw invalidCredentials();
      }

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: context.role,
          depotId: context.depotId,
          mustChangePassword: user.mustChangePassword,
        },
        depot: { id: depot.id, name: depot.name, status: depot.status },
      };
    });
  }

  /**
   * Changes the caller's own password. The current password is required even though the caller
   * already holds a token, so a stolen access token cannot be turned into a permanent takeover.
   * A successful change also clears must_change_password and any login lockout.
   */
  async changePassword(
    principal: AuthenticatedPrincipal,
    dto: ChangePasswordDto,
  ): Promise<{ mustChangePassword: boolean }> {
    const user = await this.prisma.authGetUser(principal.userId);

    if (user === null || !user.isActive || !this.isPasswordOwner(principal, user)) {
      throw invalidCredentials();
    }

    const passwordHash = await this.verifyAndHashPassword(user.passwordHash, dto);

    if (principal.role === PLATFORM_ADMIN_ROLE) {
      await this.prisma.runAsPlatformAdmin(principal, async (transaction) => {
        await transaction.user.update({
          where: { id: user.id },
          data: {
            passwordHash,
            mustChangePassword: false,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });
        await transaction.auditLog.create({
          data: {
            depotId: null,
            actorUserId: user.id,
            action: AUDIT_ACTIONS.PASSWORD_CHANGED,
            entityType: 'User',
            entityId: user.id,
          },
        });
      });

      return { mustChangePassword: false };
    }

    const context = TenantContext.fromPrincipal(principal);

    await this.prisma.runAsTenant(context, async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: user.id,
          action: AUDIT_ACTIONS.PASSWORD_CHANGED,
          entityType: 'User',
          entityId: user.id,
        },
      });
    });

    return { mustChangePassword: false };
  }

  private isPasswordOwner(principal: AuthenticatedPrincipal, user: AuthUserRecord): boolean {
    if (principal.role === PLATFORM_ADMIN_ROLE) {
      return user.depotId === null && user.roleCode === PLATFORM_ADMIN_ROLE;
    }

    return user.depotId === principal.depotId && user.roleCode === principal.role;
  }

  private async verifyAndHashPassword(
    currentHash: string,
    dto: ChangePasswordDto,
  ): Promise<string> {
    const matches = await this.passwords.verify(dto.currentPassword, currentHash);

    if (!matches) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (await this.passwords.verify(dto.newPassword, currentHash)) {
      throw new BadRequestException('New password must be different from the current password');
    }

    return this.passwords.hash(dto.newPassword);
  }

  private loginBlockReason(user: AuthUserRecord): LoginBlockReason | null {
    if (!isUserRole(user.roleCode)) {
      return 'ACCOUNT_UNAVAILABLE';
    }

    if (user.roleCode === PLATFORM_ADMIN_ROLE) {
      return user.depotId === null ? null : 'ACCOUNT_UNAVAILABLE';
    }

    if (user.depotId === null) {
      return 'ACCOUNT_UNAVAILABLE';
    }

    switch (user.depotStatus) {
      case 'PENDING':
        return 'DEPOT_PENDING';
      case 'REJECTED':
        return 'DEPOT_REJECTED';
      case 'SUSPENDED':
        return 'DEPOT_SUSPENDED';
      case 'APPROVED':
        return null;
      default:
        return 'ACCOUNT_UNAVAILABLE';
    }
  }

  private toUserRole(user: AuthUserRecord): UserRole {
    if (!isUserRole(user.roleCode)) {
      throw invalidCredentials();
    }
    return user.roleCode;
  }

  private async writeLoginAudit(user: AuthUserRecord, ipAddress: string | null): Promise<void> {
    const data = {
      actorUserId: user.id,
      action: AUDIT_ACTIONS.USER_LOGIN,
      entityType: 'User',
      entityId: user.id,
      ipAddress,
      metadata: { role: user.roleCode },
    };

    if (user.roleCode === PLATFORM_ADMIN_ROLE) {
      await this.prisma.runAsPlatformAdmin(
        { userId: user.id, role: PLATFORM_ADMIN_ROLE, depotId: null },
        async (transaction) => {
          await transaction.auditLog.create({ data: { ...data, depotId: null } });
        },
      );
      return;
    }

    if (user.depotId === null) {
      throw invalidCredentials();
    }

    const context = TenantContext.fromPrincipal({
      userId: user.id,
      role: this.toUserRole(user),
      depotId: user.depotId,
    });

    await this.prisma.runAsTenant(context, async (transaction) => {
      await transaction.auditLog.create({ data: { ...data, depotId: user.depotId } });
    });
  }
}
