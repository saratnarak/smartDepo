import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/bootstrap/configure-app.js';
import { API_PREFIX } from '../src/common/constants/api.constants.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { MemoryStorageProvider } from '../src/modules/storage/memory-storage.service.js';
import { STORAGE_PROVIDER } from '../src/modules/storage/storage.provider.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { getTestDatabaseUrl } from './support/test-database.js';

interface RegisterResponse {
  depot: { id: string };
}

interface LoginResponse {
  accessToken: string;
}

interface UploadResponse {
  url: string;
  key: string;
  contentType: string;
  method: string;
  expiresIn: number;
}

const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);

const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);

describe('R2 file storage (database)', () => {
  const runId = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const ownerPassword = 'OwnerPass123';
  const staffPassword = 'StaffPass123';
  const adminPassword = 'AdminPass123';
  const api = `/${API_PREFIX}`;

  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: App;
  let provider: MemoryStorageProvider;

  let adminToken: string;
  let adminPrincipal: { userId: string; role: 'PLATFORM_ADMIN'; depotId: null };

  let ownerATokens: LoginResponse;
  let ownerBTokens: LoginResponse;
  let stockKeeperTokens: LoginResponse;
  let salesTokens: LoginResponse;
  let depotAId: string;
  let depotBId: string;
  let productAId: string;
  let productBId: string;

  const phoneSuffix = String(
    [...runId].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) % 100_000_000, 7),
  ).padStart(8, '0');

  function uniquePhone(index: number): string {
    return `+855${phoneSuffix}${String(index)}`;
  }

  function auth(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
  }

  async function registerDepot(
    name: string,
    email: string,
    phone: string,
  ): Promise<RegisterResponse> {
    const response = await request(server)
      .post(`${api}/auth/register`)
      .send({ depotName: name, ownerName: `${name} Owner`, phone, email, password: ownerPassword })
      .expect(201);

    return response.body as RegisterResponse;
  }

  async function approveDepot(depotId: string): Promise<void> {
    await request(server)
      .post(`${api}/platform/depots/${depotId}/approve`)
      .set(auth(adminToken))
      .expect(200);
  }

  async function login(identifier: string, password: string): Promise<LoginResponse> {
    const response = await request(server)
      .post(`${api}/auth/login`)
      .send({ identifier, password })
      .expect(200);

    return response.body as LoginResponse;
  }

  async function createStaff(name: string, role: string): Promise<string> {
    const email = `storage-${role.toLowerCase()}-${runId}@example.com`;
    await request(server)
      .post(`${api}/users`)
      .set(auth(ownerATokens.accessToken))
      .send({ name, email, phone: uniquePhone(role.length), role, password: staffPassword })
      .expect(201);

    return email;
  }

  async function createProduct(token: string, sku: string): Promise<string> {
    const response = await request(server)
      .post(`${api}/products`)
      .set(auth(token))
      .send({ sku, name: `Storage ${sku}`, baseUnit: 'bottle' })
      .expect(201);

    return (response.body as { id: string }).id;
  }

  async function auditActions(depotId: string): Promise<string[]> {
    const audits = await prisma.runAsPlatformAdmin(adminPrincipal, (transaction) =>
      transaction.auditLog.findMany({ where: { depotId }, orderBy: { createdAt: 'asc' } }),
    );
    return audits.map((audit) => audit.action);
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = getTestDatabaseUrl();
    process.env.BCRYPT_ROUNDS = '4';
    process.env.NODE_ENV = 'test';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    provider = app.get<MemoryStorageProvider>(STORAGE_PROVIDER);

    adminPrincipal = { userId: randomUUID(), role: 'PLATFORM_ADMIN', depotId: null };
    const adminHash = await app.get(PasswordService).hash(adminPassword);
    const adminEmail = `storage-admin-${runId}@example.com`;

    await prisma.runAsPlatformAdmin(adminPrincipal, async (transaction) => {
      const role = await transaction.role.findUnique({ where: { code: 'PLATFORM_ADMIN' } });
      if (role === null) {
        throw new Error('PLATFORM_ADMIN role is missing');
      }
      await transaction.user.create({
        data: {
          name: 'Platform Admin',
          email: adminEmail,
          passwordHash: adminHash,
          roleId: role.id,
        },
      });
    });

    adminToken = (await login(adminEmail, adminPassword)).accessToken;

    const depotA = await registerDepot(
      'Storage Depot A',
      `storage-a-${runId}@example.com`,
      uniquePhone(1),
    );
    depotAId = depotA.depot.id;
    await approveDepot(depotAId);
    ownerATokens = await login(`storage-a-${runId}@example.com`, ownerPassword);

    const stockKeeperEmail = await createStaff('Storage Stock Keeper', 'STOCK_KEEPER');
    stockKeeperTokens = await login(stockKeeperEmail, staffPassword);
    const salesEmail = await createStaff('Storage Sales', 'SALES');
    salesTokens = await login(salesEmail, staffPassword);

    const depotB = await registerDepot(
      'Storage Depot B',
      `storage-b-${runId}@example.com`,
      uniquePhone(2),
    );
    depotBId = depotB.depot.id;
    await approveDepot(depotBId);
    ownerBTokens = await login(`storage-b-${runId}@example.com`, ownerPassword);

    productAId = await createProduct(ownerATokens.accessToken, 'STORE-A');
    productBId = await createProduct(ownerBTokens.accessToken, 'STORE-B');
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication for storage endpoints', async () => {
    await request(server)
      .post(`${api}/storage/logo/upload-url`)
      .send({ contentType: 'image/png' })
      .expect(401);
  });

  it('uploads and replaces a depot logo, deleting the old object', async () => {
    const first = await request(server)
      .post(`${api}/storage/logo/upload-url`)
      .set(auth(ownerATokens.accessToken))
      .send({ contentType: 'image/png' })
      .expect(200);

    const firstKey = (first.body as UploadResponse).key;
    expect(firstKey).toMatch(new RegExp(`^depots/${depotAId}/logo/`));

    provider.putObject(firstKey, PNG_BYTES, 'image/png');

    await request(server)
      .post(`${api}/storage/logo/confirm`)
      .set(auth(ownerATokens.accessToken))
      .send({ key: firstKey })
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({ key: firstKey });
      });

    const read = await request(server)
      .post(`${api}/storage/logo/read-url`)
      .set(auth(ownerATokens.accessToken))
      .expect(200);

    expect((read.body as { url: string; key: string }).key).toBe(firstKey);

    // Replace with a JPEG; the old PNG object must be deleted.
    const second = await request(server)
      .post(`${api}/storage/logo/upload-url`)
      .set(auth(ownerATokens.accessToken))
      .send({ contentType: 'image/jpeg' })
      .expect(200);

    const secondKey = (second.body as UploadResponse).key;
    provider.putObject(secondKey, JPEG_BYTES, 'image/jpeg');

    await request(server)
      .post(`${api}/storage/logo/confirm`)
      .set(auth(ownerATokens.accessToken))
      .send({ key: secondKey })
      .expect(200);

    expect(await provider.inspectObject(firstKey)).toBeNull();
    expect(await provider.inspectObject(secondKey)).not.toBeNull();
    expect(await auditActions(depotAId)).toEqual(expect.arrayContaining(['DEPOT_LOGO_UPDATED']));
  });

  it('validates content type, size, and real file type', async () => {
    await request(server)
      .post(`${api}/storage/logo/upload-url`)
      .set(auth(ownerATokens.accessToken))
      .send({ contentType: 'image/gif' })
      .expect(400);

    const upload = await request(server)
      .post(`${api}/storage/logo/upload-url`)
      .set(auth(ownerATokens.accessToken))
      .send({ contentType: 'image/png' })
      .expect(200);

    const key = (upload.body as UploadResponse).key;

    // Not an image despite the .png key.
    provider.putObject(key, Buffer.from('plain text bytes'), 'text/plain');
    await request(server)
      .post(`${api}/storage/logo/confirm`)
      .set(auth(ownerATokens.accessToken))
      .send({ key })
      .expect(400);

    // Too large.
    const bigKey = `depots/${depotAId}/logo/${randomUUID()}/${randomUUID()}.png`;
    const big = Buffer.concat([PNG_BYTES, Buffer.alloc(2 * 1024 * 1024)]);
    provider.putObject(bigKey, big, 'image/png');
    await request(server)
      .post(`${api}/storage/logo/confirm`)
      .set(auth(ownerATokens.accessToken))
      .send({ key: bigKey })
      .expect(400);
  });

  it('lets the stock keeper manage product images but not the logo', async () => {
    const upload = await request(server)
      .post(`${api}/storage/products/${productAId}/image-upload-url`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({ contentType: 'image/png' })
      .expect(200);

    const key = (upload.body as UploadResponse).key;
    expect(key).toMatch(new RegExp(`^depots/${depotAId}/products/`));

    provider.putObject(key, PNG_BYTES, 'image/png');

    await request(server)
      .post(`${api}/storage/products/${productAId}/image-confirm`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({ key })
      .expect(200);

    await request(server)
      .post(`${api}/storage/products/${productAId}/image-read-url`)
      .set(auth(stockKeeperTokens.accessToken))
      .expect(200);

    await request(server)
      .post(`${api}/storage/logo/upload-url`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({ contentType: 'image/png' })
      .expect(403);
  });

  it('forbids sales from managing product images and read URLs', async () => {
    await request(server)
      .post(`${api}/storage/products/${productAId}/image-upload-url`)
      .set(auth(salesTokens.accessToken))
      .send({ contentType: 'image/png' })
      .expect(403);

    await request(server)
      .post(`${api}/storage/products/${productAId}/image-read-url`)
      .set(auth(salesTokens.accessToken))
      .expect(403);
  });

  it('does not issue URLs or confirm images for another depot product', async () => {
    await request(server)
      .post(`${api}/storage/products/${productBId}/image-upload-url`)
      .set(auth(ownerATokens.accessToken))
      .send({ contentType: 'image/png' })
      .expect(404);

    await request(server)
      .post(`${api}/storage/products/${productBId}/image-read-url`)
      .set(auth(ownerATokens.accessToken))
      .expect(404);

    const foreignKey = `depots/${depotBId}/products/${randomUUID()}/${randomUUID()}.png`;
    provider.putObject(foreignKey, PNG_BYTES, 'image/png');

    await request(server)
      .post(`${api}/storage/products/${productAId}/image-confirm`)
      .set(auth(ownerATokens.accessToken))
      .send({ key: foreignKey })
      .expect(400);
  });

  it('rejects a confirm with no uploaded object', async () => {
    const missingKey = `depots/${depotAId}/logo/${randomUUID()}/${randomUUID()}.png`;

    await request(server)
      .post(`${api}/storage/logo/confirm`)
      .set(auth(ownerATokens.accessToken))
      .send({ key: missingKey })
      .expect(404);
  });
});
