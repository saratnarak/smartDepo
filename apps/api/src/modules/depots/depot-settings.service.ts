import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AUDIT_ACTIONS } from '../../common/audit/audit-actions.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UpdateDepotSettingsDto } from './dto/update-depot-settings.dto.js';

const settingsSelect = {
  id: true,
  name: true,
  address: true,
  currency: true,
  locale: true,
  invoiceFooter: true,
  logoKey: true,
  creditLimitMode: true,
} as const;

export interface DepotSettingsView {
  id: string;
  name: string;
  address: string | null;
  currency: string;
  locale: string;
  invoiceFooter: string | null;
  logoKey: string | null;
  creditLimitMode: string;
}

/**
 * Depot settings (FR-10). The depot id always comes from the access token, so a caller cannot read
 * or change another depot's settings. Every depot role may read the display settings (an invoice
 * needs the name, address, currency, language, and footer); only the owner may update them.
 */
@Injectable()
export class DepotSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(principal: AuthenticatedPrincipal): Promise<DepotSettingsView> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const depot = await transaction.depot.findUnique({
        where: { id: context.depotId },
        select: settingsSelect,
      });

      if (depot === null) {
        throw new NotFoundException('Depot not found');
      }

      return depot;
    });
  }

  async update(
    principal: AuthenticatedPrincipal,
    dto: UpdateDepotSettingsDto,
  ): Promise<DepotSettingsView> {
    if (
      dto.name === undefined &&
      dto.address === undefined &&
      dto.currency === undefined &&
      dto.locale === undefined &&
      dto.invoiceFooter === undefined &&
      dto.creditLimitMode === undefined
    ) {
      throw new BadRequestException('At least one setting must be provided');
    }

    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const existing = await transaction.depot.findUnique({
        where: { id: context.depotId },
        select: settingsSelect,
      });

      if (existing === null) {
        throw new NotFoundException('Depot not found');
      }

      const depot = await transaction.depot.update({
        where: { id: context.depotId },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name }),
          ...(dto.address === undefined ? {} : { address: dto.address }),
          ...(dto.currency === undefined ? {} : { currency: dto.currency }),
          ...(dto.locale === undefined ? {} : { locale: dto.locale }),
          ...(dto.invoiceFooter === undefined ? {} : { invoiceFooter: dto.invoiceFooter }),
          ...(dto.creditLimitMode === undefined ? {} : { creditLimitMode: dto.creditLimitMode }),
        },
        select: settingsSelect,
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.DEPOT_SETTINGS_UPDATED,
          entityType: 'Depot',
          entityId: depot.id,
          before: existing,
          after: depot,
        },
      });

      return depot;
    });
  }
}
