import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { AUDIT_ACTIONS } from '../../common/audit/audit-actions.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ConfirmImageDto } from './dto/confirm-image.dto.js';
import type { PresignUploadDto } from './dto/presign-upload.dto.js';
import { detectImageContentType, extForContentType, MAX_IMAGE_BYTES } from './image-validation.js';
import type { ObjectInspection } from './storage.provider.js';
import { PRESIGN_TTL_SECONDS, STORAGE_PROVIDER } from './storage.provider.js';
import type { StorageProvider } from './storage.provider.js';

type ImageKind = 'logo' | 'products';

interface UploadResult {
  url: string;
  key: string;
  contentType: string;
  method: 'PUT';
  expiresIn: number;
}

/**
 * Presigned-URL file storage (FR-10 depot logo, FR-8 product images). Object keys are built from
 * the token depot id and never from request input. Confirm validates the real magic bytes and size,
 * stores only the key, deletes the previous object, and writes an audit entry.
 */
@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly provider: StorageProvider,
    private readonly prisma: PrismaService,
  ) {}

  async presignLogoUpload(
    principal: AuthenticatedPrincipal,
    dto: PresignUploadDto,
  ): Promise<UploadResult> {
    const context = TenantContext.fromPrincipal(principal);
    const ext = this.assertContentType(dto.contentType);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const depot = await transaction.depot.findUnique({
        where: { id: context.depotId },
        select: { id: true },
      });

      if (depot === null) {
        throw new NotFoundException('Depot not found');
      }

      const key = this.objectKey(context.depotId, 'logo', principal.userId, ext);
      const url = await this.provider.presignUploadUrl(key, dto.contentType, PRESIGN_TTL_SECONDS);

      return {
        url,
        key,
        contentType: dto.contentType,
        method: 'PUT',
        expiresIn: PRESIGN_TTL_SECONDS,
      };
    });
  }

  async presignLogoRead(
    principal: AuthenticatedPrincipal,
  ): Promise<{ url: string; key: string; expiresIn: number }> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const depot = await transaction.depot.findUnique({
        where: { id: context.depotId },
        select: { logoKey: true },
      });

      if (depot === null || depot.logoKey === null) {
        throw new NotFoundException('No logo has been uploaded');
      }

      const url = await this.provider.presignReadUrl(depot.logoKey, PRESIGN_TTL_SECONDS);

      return { url, key: depot.logoKey, expiresIn: PRESIGN_TTL_SECONDS };
    });
  }

  async confirmLogo(
    principal: AuthenticatedPrincipal,
    dto: ConfirmImageDto,
  ): Promise<{ key: string }> {
    const context = TenantContext.fromPrincipal(principal);
    const key = this.assertKey(dto.key, context.depotId, 'logo');
    const inspection = await this.provider.inspectObject(key);
    this.assertImage(inspection, key);

    const oldKey = await this.prisma.runAsTenant(context, async (transaction) => {
      const depot = await transaction.depot.findUnique({
        where: { id: context.depotId },
        select: { id: true, logoKey: true },
      });

      if (depot === null) {
        throw new NotFoundException('Depot not found');
      }

      await transaction.depot.update({
        where: { id: context.depotId },
        data: { logoKey: key },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.DEPOT_LOGO_UPDATED,
          entityType: 'Depot',
          entityId: context.depotId,
          before: depot.logoKey === null ? undefined : { logoKey: depot.logoKey },
          after: { logoKey: key },
        },
      });

      return depot.logoKey;
    });

    if (oldKey !== null && oldKey !== key) {
      await this.deleteQuietly(oldKey);
    }

    return { key };
  }

  async presignProductUpload(
    principal: AuthenticatedPrincipal,
    productId: string,
    dto: PresignUploadDto,
  ): Promise<UploadResult> {
    const context = TenantContext.fromPrincipal(principal);
    const ext = this.assertContentType(dto.contentType);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const product = await transaction.product.findFirst({
        where: { id: productId },
        select: { id: true },
      });

      if (product === null) {
        throw new NotFoundException('Product not found');
      }

      const key = this.objectKey(context.depotId, 'products', principal.userId, ext);
      const url = await this.provider.presignUploadUrl(key, dto.contentType, PRESIGN_TTL_SECONDS);

      return {
        url,
        key,
        contentType: dto.contentType,
        method: 'PUT',
        expiresIn: PRESIGN_TTL_SECONDS,
      };
    });
  }

  async presignProductRead(
    principal: AuthenticatedPrincipal,
    productId: string,
  ): Promise<{ url: string; key: string; expiresIn: number }> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const product = await transaction.product.findFirst({
        where: { id: productId },
        select: { imageKey: true },
      });

      if (product === null || product.imageKey === null) {
        throw new NotFoundException('No image has been uploaded');
      }

      const url = await this.provider.presignReadUrl(product.imageKey, PRESIGN_TTL_SECONDS);

      return { url, key: product.imageKey, expiresIn: PRESIGN_TTL_SECONDS };
    });
  }

  async confirmProduct(
    principal: AuthenticatedPrincipal,
    productId: string,
    dto: ConfirmImageDto,
  ): Promise<{ key: string }> {
    const context = TenantContext.fromPrincipal(principal);
    const key = this.assertKey(dto.key, context.depotId, 'products');
    const inspection = await this.provider.inspectObject(key);
    this.assertImage(inspection, key);

    const oldKey = await this.prisma.runAsTenant(context, async (transaction) => {
      const product = await transaction.product.findFirst({
        where: { id: productId },
        select: { id: true, imageKey: true },
      });

      if (product === null) {
        throw new NotFoundException('Product not found');
      }

      await transaction.product.update({
        where: { id: productId },
        data: { imageKey: key },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.PRODUCT_IMAGE_UPDATED,
          entityType: 'Product',
          entityId: productId,
          before: product.imageKey === null ? undefined : { imageKey: product.imageKey },
          after: { imageKey: key },
        },
      });

      return product.imageKey;
    });

    if (oldKey !== null && oldKey !== key) {
      await this.deleteQuietly(oldKey);
    }

    return { key };
  }

  private objectKey(depotId: string, kind: ImageKind, userId: string, ext: string): string {
    return `depots/${depotId}/${kind}/${userId}/${randomUUID()}.${ext}`;
  }

  private assertContentType(contentType: string): string {
    const ext = extForContentType(contentType);

    if (ext === null) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');
    }

    return ext;
  }

  private assertKey(key: string, depotId: string, kind: ImageKind): string {
    const prefix = `depots/${depotId}/${kind}/`;

    if (!key.startsWith(prefix)) {
      throw new BadRequestException('Object key does not belong to this depot');
    }

    return key;
  }

  private assertImage(inspection: ObjectInspection | null, key: string): void {
    if (inspection === null) {
      throw new NotFoundException('Uploaded object not found');
    }

    const detected = detectImageContentType(inspection.magicBytes);

    if (detected === null) {
      throw new BadRequestException('Unsupported image type');
    }

    const expectedExt = extForContentType(detected);

    if (expectedExt === null || !key.endsWith(`.${expectedExt}`)) {
      throw new BadRequestException('Image type does not match the object key');
    }

    if (inspection.contentLength === undefined || inspection.contentLength <= 0) {
      throw new BadRequestException('Uploaded object is empty');
    }

    if (inspection.contentLength > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Image must be 2 MB or smaller');
    }
  }

  private async deleteQuietly(key: string): Promise<void> {
    try {
      await this.provider.deleteObject(key);
    } catch {
      // Deleting the old object is best effort; the new key is already authoritative.
    }
  }
}
