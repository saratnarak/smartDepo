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
import { PrismaService } from '../src/prisma/prisma.service.js';
import { getTestDatabaseUrl } from './support/test-database.js';

interface RegisterResponse {
  depot: { id: string; name: string; status: string };
  owner: { id: string; name: string; email: string; phone: string };
}

interface LoginResponse {
  accessToken: string;
  user: { id: string; role: string; depotId: string | null };
}

interface PlanView {
  code: string;
  name: string;
  priceMonthly: string;
  maxUsers: number | null;
  maxProducts: number | null;
}

interface DepotPlanView {
  plan: PlanView | null;
  usage: { users: number; products: number };
  limits: { users: number | null; products: number | null };
  overLimit: boolean;
}

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: { id: string; name: string; role: string } | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

describe('Plans and the audit log (database)', () => {
  const runId = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const ownerPassword = 'OwnerPass123';
  const staffPassword = 'StaffPass123';
  const adminPassword = 'AdminPass123';
  const api = `/${API_PREFIX}`;

  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: App;

  let adminToken: string;
  let adminPrincipal: { userId: string; role: 'PLATFORM_ADMIN'; depotId: null };

  let depotAId: string;
  let depotBId: string;
  let depotCId: string;
  let ownerAToken: string;
  let ownerBToken: string;
  let salesToken: string;
  let keeperToken: string;
  let deliveryToken: string;

  const phoneSuffix = String(
    [...runId].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) % 100_000_000, 13),
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

  async function login(identifier: string, password: string): Promise<LoginResponse> {
    const response = await request(server)
      .post(`${api}/auth/login`)
      .send({ identifier, password })
      .expect(200);

    return response.body as LoginResponse;
  }

  async function createStaff(
    token: string,
    role: 'SALES' | 'STOCK_KEEPER' | 'DELIVERY',
    index: number,
  ): Promise<string> {
    const email = `staff-${role}-${runId}-${String(index)}@example.com`;
    await request(server)
      .post(`${api}/users`)
      .set(auth(token))
      .send({
        name: `Staff ${role} ${index}`,
        email,
        phone: uniquePhone(100 + index),
        role,
        password: staffPassword,
      })
      .expect(201);

    return email;
  }

  async function createProduct(token: string, index: number): Promise<void> {
    await request(server)
      .post(`${api}/products`)
      .set(auth(token))
      .send({
        sku: `PLAN-${String(index).padStart(3, '0')}`,
        name: `Limit Product ${index}`,
        baseUnit: 'bottle',
      })
      .expect(201);
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

    const adminEmail = `plans-admin-${runId}@example.com`;
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

    const adminLogin = await login(adminEmail, adminPassword);

    adminToken = adminLogin.accessToken;
    adminPrincipal = { userId: adminLogin.user.id, role: 'PLATFORM_ADMIN', depotId: null };

    const depotA = await registerDepot(
      'Plans Depot A',
      `plans-a-${runId}@example.com`,
      uniquePhone(1),
    );
    depotAId = depotA.depot.id;
    await request(server)
      .post(`${api}/platform/depots/${depotAId}/approve`)
      .set(auth(adminToken))
      .expect(200);
    ownerAToken = (await login(`plans-a-${runId}@example.com`, ownerPassword)).accessToken;

    const depotB = await registerDepot(
      'Plans Depot B',
      `plans-b-${runId}@example.com`,
      uniquePhone(2),
    );
    depotBId = depotB.depot.id;
    await request(server)
      .post(`${api}/platform/depots/${depotBId}/approve`)
      .set(auth(adminToken))
      .expect(200);
    ownerBToken = (await login(`plans-b-${runId}@example.com`, ownerPassword)).accessToken;

    const depotC = await registerDepot(
      'Plans Depot C',
      `plans-c-${runId}@example.com`,
      uniquePhone(3),
    );
    depotCId = depotC.depot.id;
    await request(server)
      .post(`${api}/platform/depots/${depotCId}/approve`)
      .set(auth(adminToken))
      .expect(200);

    // The staff accounts live in depot B, which moves to the Pro plan first: the Free Trial plan
    // allows two users, and depot A keeps that plan for the limit tests.
    await request(server)
      .patch(`${api}/platform/depots/${depotBId}/plan`)
      .set(auth(adminToken))
      .send({ planCode: 'PRO' })
      .expect(200);

    const salesEmail = await createStaff(ownerBToken, 'SALES', 1);
    salesToken = (await login(salesEmail, staffPassword)).accessToken;
    const keeperEmail = await createStaff(ownerBToken, 'STOCK_KEEPER', 2);
    keeperToken = (await login(keeperEmail, staffPassword)).accessToken;
    const deliveryEmail = await createStaff(ownerBToken, 'DELIVERY', 3);
    deliveryToken = (await login(deliveryEmail, staffPassword)).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('gives every new depot the Free Trial plan', async () => {
    const response = await request(server)
      .get(`${api}/depot/plan`)
      .set(auth(ownerAToken))
      .expect(200);

    const body = response.body as DepotPlanView;

    expect(body.plan?.code).toBe('FREE_TRIAL');
    expect(body.plan?.priceMonthly).toBe('0.00');
    expect(body.limits).toEqual({ users: 5, products: 10 });
    expect(body.usage.users).toBeGreaterThanOrEqual(1);
    expect(body.overLimit).toBe(false);
  });

  it('shows the plan of a depot in the list of the platform', async () => {
    const response = await request(server)
      .get(`${api}/platform/depots`)
      .query({ pageSize: 50 })
      .set(auth(adminToken))
      .expect(200);

    const page = response.body as Paginated<{
      id: string;
      plan: { code: string; name: string } | null;
    }>;
    const depotA = page.data.find((depot) => depot.id === depotAId);

    expect(depotA?.plan?.code).toBe('FREE_TRIAL');
    expect(depotA?.plan?.name).toBe('Free Trial');
  });

  it('lets only the owner read the plan of the depot', async () => {
    await request(server).get(`${api}/depot/plan`).set(auth(salesToken)).expect(403);
    await request(server).get(`${api}/depot/plan`).set(auth(keeperToken)).expect(403);
    await request(server).get(`${api}/depot/plan`).set(auth(deliveryToken)).expect(403);
    await request(server).get(`${api}/depot/plan`).expect(401);
  });

  it('lists the plans of the platform for the platform admin only', async () => {
    const response = await request(server)
      .get(`${api}/platform/plans`)
      .set(auth(adminToken))
      .expect(200);

    const plans = response.body as PlanView[];

    // The suites share the test database, so another suite may have added a plan of its own.
    expect(plans.map((plan) => plan.code)).toEqual(
      expect.arrayContaining(['FREE_TRIAL', 'BASIC', 'PRO']),
    );
    expect(plans.find((plan) => plan.code === 'FREE_TRIAL')).toMatchObject({
      name: 'Free Trial',
      priceMonthly: '0.00',
      maxUsers: 5,
      maxProducts: 10,
    });
    expect(plans.find((plan) => plan.code === 'BASIC')).toMatchObject({
      priceMonthly: '19.00',
      maxUsers: 15,
      maxProducts: 100,
    });
    expect(plans.find((plan) => plan.code === 'PRO')).toMatchObject({
      priceMonthly: '49.00',
      maxUsers: 50,
      maxProducts: 1000,
    });

    await request(server).get(`${api}/platform/plans`).set(auth(ownerAToken)).expect(403);
    await request(server).get(`${api}/platform/plans`).expect(401);
  });

  it('changes the plan of a depot and writes it to the audit log', async () => {
    const response = await request(server)
      .patch(`${api}/platform/depots/${depotCId}/plan`)
      .set(auth(adminToken))
      .send({ planCode: 'PRO' })
      .expect(200);

    const body = response.body as DepotPlanView;

    expect(body.plan?.code).toBe('PRO');
    expect(body.limits).toEqual({ users: 50, products: 1000 });

    const ownerCToken = (await login(`plans-c-${runId}@example.com`, ownerPassword)).accessToken;
    const audit = await request(server)
      .get(`${api}/audit-log`)
      .query({ action: 'DEPOT_PLAN_CHANGED' })
      .set(auth(ownerCToken))
      .expect(200);

    const entries = (audit.body as Paginated<AuditEntry>).data;

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.before).toEqual({ planCode: 'FREE_TRIAL', planName: 'Free Trial' });
    expect(entries[0]?.after).toEqual({ planCode: 'PRO', planName: 'Pro' });

    await request(server)
      .patch(`${api}/platform/depots/${depotCId}/plan`)
      .set(auth(salesToken))
      .send({ planCode: 'PRO' })
      .expect(403);
    await request(server)
      .patch(`${api}/platform/depots/${depotCId}/plan`)
      .set(auth(ownerAToken))
      .send({ planCode: 'PRO' })
      .expect(403);
    await request(server)
      .patch(`${api}/platform/depots/${depotCId}/plan`)
      .send({ planCode: 'PRO' })
      .expect(401);
    await request(server)
      .patch(`${api}/platform/depots/${depotCId}/plan`)
      .set(auth(adminToken))
      .send({ planCode: 'NOT_A_PLAN' })
      .expect(400);
    await request(server)
      .patch(`${api}/platform/depots/${randomUUID()}/plan`)
      .set(auth(adminToken))
      .send({ planCode: 'BASIC' })
      .expect(404);
  });

  it('stops the owner of a Free Trial depot from adding one more user', async () => {
    // The Free Trial plan allows five users: the owner and four staff accounts.
    for (let index = 1; index <= 4; index += 1) {
      await request(server)
        .post(`${api}/users`)
        .set(auth(ownerAToken))
        .send({
          name: `Staff ${index}`,
          email: `limit-staff-${index}-${runId}@example.com`,
          phone: uniquePhone(190 + index),
          role: 'SALES',
          password: staffPassword,
        })
        .expect(201);
    }

    const response = await request(server)
      .post(`${api}/users`)
      .set(auth(ownerAToken))
      .send({
        name: 'One More',
        email: `one-more-${runId}@example.com`,
        phone: uniquePhone(200),
        role: 'SALES',
        password: staffPassword,
      })
      .expect(409);

    expect(response.body.details?.reason).toBe('PLAN_USER_LIMIT_REACHED');
    expect(response.body.details?.maxUsers).toBe(5);
    expect(response.body.details?.activeUsers).toBe(5);
  });

  it('stops the owner of a Free Trial depot from adding one more product', async () => {
    const plan = await request(server).get(`${api}/depot/plan`).set(auth(ownerAToken)).expect(200);

    const body = plan.body as DepotPlanView;
    const missing = (body.limits.products ?? 0) - body.usage.products;

    for (let index = 0; index < missing; index += 1) {
      await createProduct(ownerAToken, index);
    }

    const response = await request(server)
      .post(`${api}/products`)
      .set(auth(ownerAToken))
      .send({
        sku: 'PLAN-OVER-LIMIT',
        name: 'One Product Too Many',
        baseUnit: 'bottle',
      })
      .expect(409);

    expect(response.body.details?.reason).toBe('PLAN_PRODUCT_LIMIT_REACHED');
    expect(response.body.details?.maxProducts).toBe(10);
  });

  it('lets the owner add staff and products again after the plan changed', async () => {
    await request(server)
      .patch(`${api}/platform/depots/${depotAId}/plan`)
      .set(auth(adminToken))
      .send({ planCode: 'PRO' })
      .expect(200);

    const email = await createStaff(ownerAToken, 'SALES', 4);
    expect(email).toContain('@example.com');

    await createProduct(ownerAToken, 99);

    const plan = await request(server).get(`${api}/depot/plan`).set(auth(ownerAToken)).expect(200);

    const body = plan.body as DepotPlanView;

    expect(body.plan?.code).toBe('PRO');
    expect(body.limits).toEqual({ users: 50, products: 1000 });
  });

  it('shows the owner the audit log of the depot with the filters and the paging', async () => {
    const response = await request(server)
      .get(`${api}/audit-log`)
      .query({ pageSize: 5 })
      .set(auth(ownerAToken))
      .expect(200);

    const page = response.body as Paginated<AuditEntry>;

    expect(page.meta.pageSize).toBe(5);
    expect(page.data.length).toBeGreaterThan(0);
    expect(page.meta.total).toBeGreaterThanOrEqual(page.data.length);

    for (const entry of page.data) {
      expect(entry.action).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(entry.actor === null || typeof entry.actor.name === 'string').toBe(true);
    }

    const filtered = await request(server)
      .get(`${api}/audit-log`)
      .query({ action: 'STAFF_CREATED' })
      .set(auth(ownerAToken))
      .expect(200);

    const filteredPage = filtered.body as Paginated<AuditEntry>;

    expect(filteredPage.data.length).toBeGreaterThan(0);

    for (const entry of filteredPage.data) {
      expect(entry.action).toBe('STAFF_CREATED');
    }

    const sorted = await request(server)
      .get(`${api}/audit-log`)
      .query({ sort: 'createdAt', order: 'asc', pageSize: 100 })
      .set(auth(ownerAToken))
      .expect(200);

    const sortedPage = sorted.body as Paginated<AuditEntry>;
    const times = sortedPage.data.map((entry) => new Date(entry.createdAt).getTime());

    expect([...times].sort((left, right) => left - right)).toEqual(times);
  });

  it('never shows the audit log of another depot', async () => {
    const response = await request(server)
      .get(`${api}/audit-log`)
      .query({ pageSize: 100 })
      .set(auth(ownerBToken))
      .expect(200);

    const page = response.body as Paginated<AuditEntry>;

    for (const entry of page.data) {
      expect(entry.entityId).not.toBe(depotAId);
    }

    const depotBEntries = await request(server)
      .get(`${api}/audit-log`)
      .query({ action: 'DEPOT_PLAN_CHANGED', pageSize: 100 })
      .set(auth(ownerBToken))
      .expect(200);

    const changes = (depotBEntries.body as Paginated<AuditEntry>).data;

    // Depot B sees its own plan change and nothing of depot A.
    expect(changes.length).toBe(1);
    expect(changes[0]?.entityId).toBe(depotBId);
  });

  it('gives the audit log only to the owner', async () => {
    await request(server).get(`${api}/audit-log`).set(auth(salesToken)).expect(403);
    await request(server).get(`${api}/audit-log`).set(auth(keeperToken)).expect(403);
    await request(server).get(`${api}/audit-log`).set(auth(deliveryToken)).expect(403);
    await request(server).get(`${api}/audit-log`).expect(401);
    await request(server).get(`${api}/audit-log`).set(auth(adminToken)).expect(403);
  });

  it('rejects a filter that is not valid', async () => {
    await request(server)
      .get(`${api}/audit-log`)
      .query({ action: 'not an action' })
      .set(auth(ownerAToken))
      .expect(400);
    await request(server)
      .get(`${api}/audit-log`)
      .query({ pageSize: 500 })
      .set(auth(ownerAToken))
      .expect(400);
  });

  it('never returns a password hash, a token, or a secret', async () => {
    await prisma.runAsPlatformAdmin(adminPrincipal, async (transaction) => {
      await transaction.auditLog.create({
        data: {
          depotId: depotAId,
          actorUserId: adminPrincipal.userId,
          action: 'DEPOT_SETTINGS_UPDATED',
          entityType: 'Depot',
          entityId: depotAId,
          after: {
            name: 'Plans Depot A',
            passwordHash: '$2b$10$averysecrethash',
            refreshToken: 'a-refresh-token',
          },
        },
      });
    });

    const response = await request(server)
      .get(`${api}/audit-log`)
      .query({ pageSize: 100 })
      .set(auth(ownerAToken))
      .expect(200);

    const page = response.body as Paginated<AuditEntry>;
    const text = JSON.stringify(page.data);

    expect(text).not.toContain('averysecrethash');
    expect(text).not.toContain('a-refresh-token');
    expect(text).not.toContain('passwordHash');

    const entry = page.data.find((item) => item.action === 'DEPOT_SETTINGS_UPDATED');

    expect(entry?.after).toEqual({ name: 'Plans Depot A' });
  });

  it('shows the platform admin the entries of the platform only', async () => {
    const response = await request(server)
      .get(`${api}/platform/audit-log`)
      .query({ pageSize: 100 })
      .set(auth(adminToken))
      .expect(200);

    const page = response.body as Paginated<AuditEntry>;

    expect(page.data.length).toBeGreaterThan(0);

    for (const entry of page.data) {
      expect(entry.entityType).not.toBe('Product');
    }

    await request(server).get(`${api}/platform/audit-log`).set(auth(ownerAToken)).expect(403);
    await request(server).get(`${api}/platform/audit-log`).expect(401);
  });

  it('has no way to change or to remove an entry', async () => {
    await request(server)
      .patch(`${api}/audit-log`)
      .set(auth(ownerAToken))
      .send({ action: 'HACKED' })
      .expect(404);
    await request(server).delete(`${api}/audit-log`).set(auth(ownerAToken)).expect(404);
    await request(server).delete(`${api}/platform/audit-log`).set(auth(adminToken)).expect(404);
  });
});
