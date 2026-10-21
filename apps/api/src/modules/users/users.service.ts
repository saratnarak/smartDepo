import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { AUDIT_ACTIONS } from '../../common/audit/audit-actions.js';
import { assertWithinUserLimit, findActivePlan } from '../../common/plans/plan-limits.js';
import { isUniqueConstraintError } from '../../common/prisma/prisma-errors.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { TenantScopedTransactionClient } from '../../common/tenant/tenant-scope.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PasswordService } from '../auth/password.service.js';
import type { CreateStaffDto } from './dto/create-staff.dto.js';
import type { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import type { ResetStaffPasswordDto } from './dto/reset-staff-password.dto.js';
import type { UpdateStaffDto } from './dto/update-staff.dto.js';
import { isStaffRole, STAFF_ROLES } from './staff-roles.js';

const staffSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { code: true } },
} as const;

type StaffRow = Prisma.UserGetPayload<{ select: typeof staffSelect }>;

export interface StaffUserView {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function toView(user: StaffRow): StaffUserView {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role.code,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function staffWhere(query: ListUsersQueryDto): Prisma.UserWhereInput {
  const search = query.search?.trim();

  return {
    role: query.role === undefined ? { code: { in: [...STAFF_ROLES] } } : { code: query.role },
    ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    ...(search === undefined || search === ''
      ? {}
      : {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        }),
  };
}

/**
 * Owner-only staff management (FR-7) and owner-driven password resets (FR-8), always inside the
 * caller's depot. The tenant comes from the access token, never from the request. Deactivated users
 * can no longer log in or refresh because the auth service checks is_active.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async list(
    principal: AuthenticatedPrincipal,
    query: ListUsersQueryDto,
  ): Promise<{
    data: StaffUserView[];
    meta: { page: number; pageSize: number; total: number };
  }> {
    const context = TenantContext.fromPrincipal(principal);
    const where = staffWhere(query);
    const skip = (query.page - 1) * query.pageSize;

    return this.prisma.runAsTenant(context, async (transaction) => {
      const [data, total] = await Promise.all([
        transaction.user.findMany({
          where,
          select: staffSelect,
          orderBy: { [query.sort]: query.order },
          skip,
          take: query.pageSize,
        }),
        transaction.user.count({ where }),
      ]);

      return {
        data: data.map(toView),
        meta: { page: query.page, pageSize: query.pageSize, total },
      };
    });
  }

  async create(principal: AuthenticatedPrincipal, dto: CreateStaffDto): Promise<StaffUserView> {
    const context = TenantContext.fromPrincipal(principal);
    const passwordHash = await this.passwords.hash(dto.password);

    try {
      return await this.prisma.runAsTenant(context, async (transaction) => {
        await assertWithinUserLimit(transaction, await findActivePlan(transaction));

        const role = await transaction.role.findUnique({ where: { code: dto.role } });

        if (role === null) {
          throw new InternalServerErrorException('Staff role is not configured');
        }

        const user = await transaction.user.create({
          data: {
            depotId: context.depotId,
            roleId: role.id,
            name: dto.name,
            email: dto.email,
            phone: dto.phone ?? null,
            passwordHash,
          },
          select: staffSelect,
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: principal.userId,
            action: AUDIT_ACTIONS.STAFF_CREATED,
            entityType: 'User',
            entityId: user.id,
            after: { name: user.name, email: user.email, role: user.role.code, isActive: true },
          },
        });

        return toView(user);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Email or phone is already registered');
      }
      throw error;
    }
  }

  async update(
    principal: AuthenticatedPrincipal,
    staffId: string,
    dto: UpdateStaffDto,
  ): Promise<StaffUserView> {
    if (
      dto.name === undefined &&
      dto.email === undefined &&
      dto.phone === undefined &&
      dto.role === undefined &&
      dto.isActive === undefined
    ) {
      throw new BadRequestException('At least one field must be provided');
    }

    const context = TenantContext.fromPrincipal(principal);

    try {
      return await this.prisma.runAsTenant(context, async (transaction) => {
        const existing = await this.findManageableStaff(transaction, staffId);

        if (dto.isActive === true && !existing.isActive) {
          await assertWithinUserLimit(transaction, await findActivePlan(transaction));
        }

        let roleId: string | undefined;

        if (dto.role !== undefined) {
          const role = await transaction.role.findUnique({ where: { code: dto.role } });

          if (role === null) {
            throw new InternalServerErrorException('Staff role is not configured');
          }

          roleId = role.id;
        }

        const user = await transaction.user.update({
          where: { id: existing.id },
          data: {
            ...(dto.name === undefined ? {} : { name: dto.name }),
            ...(dto.email === undefined ? {} : { email: dto.email }),
            ...(dto.phone === undefined ? {} : { phone: dto.phone }),
            ...(roleId === undefined ? {} : { roleId }),
            ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
          },
          select: staffSelect,
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: principal.userId,
            action: AUDIT_ACTIONS.STAFF_UPDATED,
            entityType: 'User',
            entityId: user.id,
            before: {
              name: existing.name,
              email: existing.email,
              phone: existing.phone,
              role: existing.role.code,
              isActive: existing.isActive,
            },
            after: {
              name: user.name,
              email: user.email,
              phone: user.phone,
              role: user.role.code,
              isActive: user.isActive,
            },
          },
        });

        return toView(user);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Email or phone is already registered');
      }
      throw error;
    }
  }

  async deactivate(principal: AuthenticatedPrincipal, staffId: string): Promise<StaffUserView> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const existing = await this.findManageableStaff(transaction, staffId);

      if (existing.id === principal.userId) {
        throw new ForbiddenException('You cannot deactivate your own account');
      }

      if (!existing.isActive) {
        return toView(existing);
      }

      const user = await transaction.user.update({
        where: { id: existing.id },
        data: { isActive: false },
        select: staffSelect,
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.STAFF_DEACTIVATED,
          entityType: 'User',
          entityId: user.id,
          before: { isActive: true },
          after: { isActive: false },
        },
      });

      return toView(user);
    });
  }

  async resetPassword(
    principal: AuthenticatedPrincipal,
    staffId: string,
    dto: ResetStaffPasswordDto,
  ): Promise<{ id: string; mustChangePassword: boolean }> {
    const context = TenantContext.fromPrincipal(principal);
    const passwordHash = await this.passwords.hash(dto.newPassword);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const existing = await this.findManageableStaff(transaction, staffId);

      const user = await transaction.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        select: { id: true, mustChangePassword: true },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.PASSWORD_RESET,
          entityType: 'User',
          entityId: user.id,
          after: { mustChangePassword: true },
        },
      });

      return { id: user.id, mustChangePassword: user.mustChangePassword };
    });
  }

  /**
   * Loads a staff member of the caller's depot by id. Wrong-depot ids and non-staff accounts
   * (OWNER, PLATFORM_ADMIN) are not manageable and return 404/403 without leaking another depot.
   */
  private async findManageableStaff(
    transaction: TenantScopedTransactionClient,
    staffId: string,
  ): Promise<StaffRow> {
    const user = await transaction.user.findFirst({
      where: { id: staffId },
      select: staffSelect,
    });

    if (user === null) {
      throw new NotFoundException('Staff member not found');
    }

    if (!isStaffRole(user.role.code)) {
      throw new ForbiddenException('Only staff accounts can be managed');
    }

    return user;
  }
}
