import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/bootstrap/configure-app.js';
import { API_PREFIX } from '../src/common/constants/api.constants.js';
import { TenantContext } from '../src/common/tenant/tenant-context.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { getTestDatabaseUrl } from './support/test-database.js';

interface RegisterResponse {
  depot: { id: string; name: string; status: string };
  owner: { id: string; name: string; email: string; phone: string };
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
  user: { id: string; role: string; depotId: string | null };
  depot: { id: string; name: string; status: string } | null;
}

interface DepotView {
  id: string;
  name: string;
  status: string;
  rejectionReason: string | null;
}

describe('Depot registration and authentication (database)', () => {
  const runId = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const ownerPassword = 'OwnerPass123';
  const adminPassword = 'AdminPass123';
  const api = `/${API_PREFIX}`;

  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: App;
  let adminEmail: string;
  let adminToken: string;
  let adminPrincipal: { userId: string; role: 'PLATFORM_ADMIN'; depotId: null };

  let emailA: string;
  let phoneA: string;
  let depotAId: string;
  let ownerAId: string;

  let emailB: string;
  let phoneB: string;
  let depotBId: string;

  let ownerATokens: LoginResponse;

  function uniquePhone(index: number): string {
    return `+855${String(Date.now()).slice(-8)}${String(index)}`;
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

  async function login(identifier: string, password: string): Promise<LoginResponse> {
    const response = await request(server)
      .post(`${api}/auth/login`)
      .send({ identifier, password })
      .expect(200);

    return response.body as LoginResponse;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = getTestDatabaseUrl();
    process.env.BCRYPT_ROUNDS = '4';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    adminEmail = `platform-admin-${runId}@example.com`;
    adminPrincipal = { userId: randomUUID(), role: 'PLATFORM_ADMIN', depotId: null };
    const adminHash = await app.get(PasswordService).hash(adminPassword);

    await prisma.runAsPlatformAdmin(adminPrincipal, async (transaction) => {
      const role = await transaction.role.findUnique({ where: { code: 'PLATFORM_ADMIN' } });

      if (role === null) {
        throw new Error('PLATFORM_ADMIN role is missing; run the migrations first');
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

    emailA = `depot-a-${runId}@example.com`;
    phoneA = uniquePhone(1);
    const depotA = await registerDepot('Depot A', emailA, phoneA);
    depotAId = depotA.depot.id;
    ownerAId = depotA.owner.id;

    emailB = `depot-b-${runId}@example.com`;
    phoneB = uniquePhone(2);
    const depotB = await registerDepot('Depot B', emailB, phoneB);
    depotBId = depotB.depot.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('publishes OpenAPI documentation with bearer auth and API paths', async () => {
    const response = await request(server).get('/api/docs-json').expect(200);

    expect(response.body).toMatchObject({
      info: { title: 'SmartDepo API', version: '1.0' },
      components: {
        securitySchemes: {
          'access-token': { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    });
    expect(response.body.openapi).toMatch(/^3\./);
    expect(response.body.paths).toHaveProperty('/api/v1/auth/login');
    expect(response.body.paths).toHaveProperty('/api/v1/platform/depots');
    expect(
      response.body.paths['/api/v1/auth/login'].post.requestBody.content['application/json'].schema
        .$ref,
    ).toBe('#/components/schemas/LoginDto');
  });

  it('registers a depot and its owner as PENDING', async () => {
    const response = await request(server)
      .get(`${api}/platform/depots/${depotAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: depotAId,
      name: 'Depot A',
      status: 'PENDING',
    });

    const audits = await prisma.runAsPlatformAdmin(adminPrincipal, (transaction) =>
      transaction.auditLog.findMany({ where: { depotId: depotAId } }),
    );
    expect(audits.map((audit) => audit.action)).toContain('DEPOT_REGISTERED');
  });

  it('rejects invalid registration input with validation details', async () => {
    const response = await request(server)
      .post(`${api}/auth/register`)
      .send({
        depotName: 'X',
        ownerName: '',
        phone: 'not-a-phone',
        email: 'not-an-email',
        password: 'short',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
    });
    expect(Array.isArray((response.body as { details?: unknown }).details)).toBe(true);
  });

  it('rejects a duplicate email or phone with 409', async () => {
    await request(server)
      .post(`${api}/auth/register`)
      .send({
        depotName: 'Depot A Copy',
        ownerName: 'Copy Owner',
        phone: phoneA,
        email: emailA,
        password: ownerPassword,
      })
      .expect(409);
  });

  it('requires authentication for platform endpoints', async () => {
    const response = await request(server).get(`${api}/platform/depots`).expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  });

  it('does not allow a pending depot owner to log in', async () => {
    const response = await request(server)
      .post(`${api}/auth/login`)
      .send({ identifier: emailA, password: ownerPassword })
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials',
      details: { reason: 'DEPOT_PENDING', depotStatus: 'PENDING' },
    });
  });

  it('lists depots for the platform admin with pagination', async () => {
    const response = await request(server)
      .get(`${api}/platform/depots`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ page: 1, pageSize: 10, status: 'PENDING', sort: 'createdAt', order: 'desc' })
      .expect(200);

    const body = response.body as {
      data: DepotView[];
      meta: { page: number; pageSize: number; total: number };
    };

    expect(body.meta).toMatchObject({ page: 1, pageSize: 10 });
    expect(body.data.map((depot) => depot.id)).toEqual(
      expect.arrayContaining([depotAId, depotBId]),
    );
    expect(body.data.every((depot) => depot.status === 'PENDING')).toBe(true);
  });

  it('approves a depot and records an audit entry', async () => {
    const response = await request(server)
      .post(`${api}/platform/depots/${depotAId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({ id: depotAId, status: 'APPROVED' });

    const audits = await prisma.runAsPlatformAdmin(adminPrincipal, (transaction) =>
      transaction.auditLog.findMany({ where: { depotId: depotAId } }),
    );
    expect(audits.map((audit) => audit.action)).toEqual(
      expect.arrayContaining(['DEPOT_REGISTERED', 'DEPOT_APPROVED']),
    );
  });

  it('logs in an approved owner with depot and role claims', async () => {
    ownerATokens = await login(emailA, ownerPassword);

    expect(ownerATokens.tokenType).toBe('Bearer');
    expect(ownerATokens.user).toMatchObject({ id: ownerAId, role: 'OWNER', depotId: depotAId });
    expect(ownerATokens.depot).toMatchObject({ id: depotAId, status: 'APPROVED' });
    expect(ownerATokens.refreshToken).not.toBe('');

    const audits = await prisma.runAsPlatformAdmin(adminPrincipal, (transaction) =>
      transaction.auditLog.findMany({ where: { depotId: depotAId } }),
    );
    expect(audits.map((audit) => audit.action)).toContain('USER_LOGIN');
  });

  it('returns only the caller depot and user through /auth/me and the tenant scope', async () => {
    const response = await request(server)
      .get(`${api}/auth/me`)
      .set('Authorization', `Bearer ${ownerATokens.accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      user: { id: ownerAId, role: 'OWNER', depotId: depotAId },
      depot: { id: depotAId, name: 'Depot A', status: 'APPROVED' },
    });

    const context = TenantContext.fromPrincipal({
      userId: ownerAId,
      role: 'OWNER',
      depotId: depotAId,
    });
    const [depots, users] = await prisma.runAsTenant(context, async (transaction) => {
      return Promise.all([transaction.depot.findMany(), transaction.user.findMany()]);
    });

    expect(depots.map((depot) => depot.id)).toEqual([depotAId]);
    expect(users.map((user) => user.id)).toEqual([ownerAId]);
  });

  it('forbids a depot owner from platform endpoints, including another depot id', async () => {
    await request(server)
      .get(`${api}/platform/depots`)
      .set('Authorization', `Bearer ${ownerATokens.accessToken}`)
      .expect(403);

    await request(server)
      .get(`${api}/platform/depots/${depotBId}`)
      .set('Authorization', `Bearer ${ownerATokens.accessToken}`)
      .expect(403);
  });

  it('refreshes tokens and rejects an access token on the refresh path', async () => {
    const refreshed = await request(server)
      .post(`${api}/auth/refresh`)
      .send({ refreshToken: ownerATokens.refreshToken })
      .expect(200);

    expect((refreshed.body as LoginResponse).accessToken).not.toBe('');

    await request(server)
      .post(`${api}/auth/refresh`)
      .send({ refreshToken: ownerATokens.accessToken })
      .expect(401);
  });

  it('rejects a depot with a reason and blocks its owner login', async () => {
    const response = await request(server)
      .post(`${api}/platform/depots/${depotBId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Incomplete registration documents' })
      .expect(200);

    expect(response.body).toMatchObject({
      id: depotBId,
      status: 'REJECTED',
      rejectionReason: 'Incomplete registration documents',
    });

    await request(server)
      .post(`${api}/auth/login`)
      .send({ identifier: emailB, password: ownerPassword })
      .expect(401);
  });

  it('requires a reason when rejecting a depot', async () => {
    await request(server)
      .post(`${api}/platform/depots/${depotBId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: '' })
      .expect(400);
  });

  it('suspends an approved depot and blocks its owner login', async () => {
    const response = await request(server)
      .post(`${api}/platform/depots/${depotAId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Suspension test' })
      .expect(200);

    expect(response.body).toMatchObject({ id: depotAId, status: 'SUSPENDED' });

    const loginResponse = await request(server)
      .post(`${api}/auth/login`)
      .send({ identifier: emailA, password: ownerPassword })
      .expect(401);

    expect(loginResponse.body).toMatchObject({
      details: { reason: 'DEPOT_SUSPENDED', depotStatus: 'SUSPENDED' },
    });
  });
});
