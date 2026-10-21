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
import { withOwnerTestClient } from './support/owner-database.js';
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
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    depotId: string | null;
    mustChangePassword: boolean;
  };
  depot: { id: string; name: string; status: string } | null;
}

interface StaffView {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StaffListBody {
  data: StaffView[];
  meta: { page: number; pageSize: number; total: number };
}

interface SettingsView {
  id: string;
  name: string;
  address: string | null;
  currency: string;
  locale: string;
  invoiceFooter: string | null;
}

describe('Staff management, passwords, and depot settings (database)', () => {
  const runId = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const ownerPassword = 'OwnerPass123';
  const staffPassword = 'StaffPass123';
  const adminPassword = 'AdminPass123';
  const api = `/${API_PREFIX}`;

  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: App;

  let adminEmail: string;
  let adminToken: string;
  let adminPrincipal: { userId: string; role: 'PLATFORM_ADMIN'; depotId: null };

  let depotAId: string;
  let ownerAId: string;
  let emailA: string;
  let ownerATokens: LoginResponse;

  let depotBId: string;
  let emailB: string;
  let ownerBTokens: LoginResponse;
  let staffBEmail: string;
  let staffBId: string;

  let depotCId: string;
  let emailC: string;
  let ownerCTokens: LoginResponse;

  let staffEmail: string;
  let staffId: string;
  let staffTokens: LoginResponse;
  let staffTempTokens: LoginResponse;

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

  async function staffAuditActions(depotId: string): Promise<string[]> {
    const audits = await prisma.runAsPlatformAdmin(adminPrincipal, (transaction) =>
      transaction.auditLog.findMany({ where: { depotId }, orderBy: { createdAt: 'asc' } }),
    );
    return audits.map((audit) => audit.action);
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

    adminEmail = `staff-admin-${runId}@example.com`;
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

    emailA = `staff-depot-a-${runId}@example.com`;
    const depotA = await registerDepot('Staff Depot A', emailA, uniquePhone(1));
    depotAId = depotA.depot.id;
    ownerAId = depotA.owner.id;
    await approveDepot(depotAId);
    ownerATokens = await login(emailA, ownerPassword);

    emailB = `staff-depot-b-${runId}@example.com`;
    const depotB = await registerDepot('Staff Depot B', emailB, uniquePhone(2));
    depotBId = depotB.depot.id;
    await approveDepot(depotBId);
    ownerBTokens = await login(emailB, ownerPassword);

    emailC = `staff-depot-c-${runId}@example.com`;
    const depotC = await registerDepot('Staff Depot C', emailC, uniquePhone(3));
    depotCId = depotC.depot.id;
    await approveDepot(depotCId);
    ownerCTokens = await login(emailC, ownerPassword);

    // Depot C gets a plan whose maxUsers equals its one existing (owner) account.
    const planId = randomUUID();
    await withOwnerTestClient(async (client) => {
      await client.query(
        `INSERT INTO "plans"
           ("id", "code", "name", "price_monthly", "max_users", "max_products", "is_active", "created_at", "updated_at")
         VALUES ($1, $2, $3, 0, 1, 100, true, now(), now())`,
        [planId, `limit-${runId}`, 'Single User Plan'],
      );
      await client.query(
        `INSERT INTO "subscriptions"
           ("id", "depot_id", "plan_id", "status", "started_at", "created_at", "updated_at")
         VALUES ($1, $2, $3, 'ACTIVE', now(), now(), now())`,
        [randomUUID(), depotCId, planId],
      );
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication for staff management', async () => {
    const response = await request(server).get(`${api}/users`).expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  });

  it('creates a staff account in the owner depot', async () => {
    staffEmail = `staff-a-${runId}@example.com`;

    const response = await request(server)
      .post(`${api}/users`)
      .set(auth(ownerATokens.accessToken))
      .send({
        name: 'Sokha Sales',
        email: staffEmail,
        phone: uniquePhone(4),
        role: 'SALES',
        password: staffPassword,
      })
      .expect(201);

    const body = response.body as StaffView;
    expect(body).toMatchObject({
      name: 'Sokha Sales',
      email: staffEmail,
      role: 'SALES',
      isActive: true,
      mustChangePassword: false,
    });
    expect(body).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(body)).not.toContain('passwordHash');

    staffId = body.id;
    expect(await staffAuditActions(depotAId)).toContain('STAFF_CREATED');
  });

  it('rejects an owner or platform admin as a staff role', async () => {
    const payload = {
      name: 'Escalation Attempt',
      email: `escalation-${runId}@example.com`,
      role: 'OWNER',
      password: staffPassword,
    };

    await request(server)
      .post(`${api}/users`)
      .set(auth(ownerATokens.accessToken))
      .send(payload)
      .expect(400);

    await request(server)
      .post(`${api}/users`)
      .set(auth(ownerATokens.accessToken))
      .send({ ...payload, role: 'PLATFORM_ADMIN' })
      .expect(400);
  });

  it('rejects invalid staff input and a depot id in the body', async () => {
    await request(server)
      .post(`${api}/users`)
      .set(auth(ownerATokens.accessToken))
      .send({
        name: 'X',
        email: 'not-an-email',
        role: 'SALES',
        password: 'short',
      })
      .expect(400);

    const response = await request(server)
      .post(`${api}/users`)
      .set(auth(ownerATokens.accessToken))
      .send({
        name: 'Other Depot Staff',
        email: `other-${runId}@example.com`,
        role: 'SALES',
        password: staffPassword,
        depotId: depotBId,
      })
      .expect(400);

    expect(response.body).toMatchObject({ message: 'Validation failed' });
  });

  it('lists staff with pagination and filters', async () => {
    const response = await request(server)
      .get(`${api}/users`)
      .set(auth(ownerATokens.accessToken))
      .query({ page: 1, pageSize: 10, role: 'SALES', isActive: 'true', sort: 'name', order: 'asc' })
      .expect(200);

    const body = response.body as StaffListBody;
    expect(body.meta).toMatchObject({ page: 1, pageSize: 10, total: 1 });
    expect(body.data.map((user) => user.id)).toEqual([staffId]);
    expect(body.data[0]).not.toHaveProperty('passwordHash');
  });

  it('forbids a SALES user from managing staff', async () => {
    staffTokens = await login(staffEmail, staffPassword);

    expect(staffTokens.user.mustChangePassword).toBe(false);

    await request(server).get(`${api}/users`).set(auth(staffTokens.accessToken)).expect(403);

    await request(server)
      .post(`${api}/users`)
      .set(auth(staffTokens.accessToken))
      .send({
        name: 'Sneaky Staff',
        email: `sneaky-${runId}@example.com`,
        role: 'SALES',
        password: staffPassword,
      })
      .expect(403);

    await request(server)
      .post(`${api}/users/${staffId}/deactivate`)
      .set(auth(staffTokens.accessToken))
      .expect(403);
  });

  it('does not expose or edit another depot staff member', async () => {
    staffBEmail = `staff-b-${runId}@example.com`;

    const created = await request(server)
      .post(`${api}/users`)
      .set(auth(ownerBTokens.accessToken))
      .send({
        name: 'Depot B Sales',
        email: staffBEmail,
        role: 'SALES',
        password: staffPassword,
      })
      .expect(201);

    staffBId = (created.body as StaffView).id;

    const list = await request(server)
      .get(`${api}/users`)
      .set(auth(ownerATokens.accessToken))
      .query({ search: staffBEmail })
      .expect(200);

    expect((list.body as StaffListBody).data).toEqual([]);

    await request(server)
      .patch(`${api}/users/${staffBId}`)
      .set(auth(ownerATokens.accessToken))
      .send({ name: 'Hijacked' })
      .expect(404);

    await request(server)
      .post(`${api}/users/${staffBId}/deactivate`)
      .set(auth(ownerATokens.accessToken))
      .expect(404);

    await request(server)
      .post(`${api}/users/${staffBId}/reset-password`)
      .set(auth(ownerATokens.accessToken))
      .send({ newPassword: 'HijackPass123' })
      .expect(404);
  });

  it('edits a staff member and records the change', async () => {
    const response = await request(server)
      .patch(`${api}/users/${staffId}`)
      .set(auth(ownerATokens.accessToken))
      .send({ name: 'Sokha Stock', role: 'STOCK_KEEPER' })
      .expect(200);

    expect(response.body).toMatchObject({
      id: staffId,
      name: 'Sokha Stock',
      role: 'STOCK_KEEPER',
    });
    expect(await staffAuditActions(depotAId)).toContain('STAFF_UPDATED');
  });

  it('rejects an empty staff update', async () => {
    await request(server)
      .patch(`${api}/users/${staffId}`)
      .set(auth(ownerATokens.accessToken))
      .send({})
      .expect(400);
  });

  it('refuses to deactivate the owner account', async () => {
    const response = await request(server)
      .post(`${api}/users/${ownerAId}/deactivate`)
      .set(auth(ownerATokens.accessToken))
      .expect(403);

    expect(response.body).toMatchObject({ statusCode: 403 });
  });

  it('deactivates a staff member and blocks login and refresh', async () => {
    const response = await request(server)
      .post(`${api}/users/${staffId}/deactivate`)
      .set(auth(ownerATokens.accessToken))
      .expect(200);

    expect(response.body).toMatchObject({ id: staffId, isActive: false });
    expect(await staffAuditActions(depotAId)).toContain('STAFF_DEACTIVATED');

    await request(server)
      .post(`${api}/auth/login`)
      .send({ identifier: staffEmail, password: staffPassword })
      .expect(401);

    await request(server)
      .post(`${api}/auth/refresh`)
      .send({ refreshToken: staffTokens.refreshToken })
      .expect(401);
  });

  it('resets a staff password and requires a change at next login', async () => {
    await request(server)
      .patch(`${api}/users/${staffId}`)
      .set(auth(ownerATokens.accessToken))
      .send({ isActive: true })
      .expect(200);

    const reset = await request(server)
      .post(`${api}/users/${staffId}/reset-password`)
      .set(auth(ownerATokens.accessToken))
      .send({ newPassword: 'Temporary2' })
      .expect(200);

    expect(reset.body).toEqual({ id: staffId, mustChangePassword: true });
    expect(JSON.stringify(reset.body)).not.toContain('Temporary2');
    expect(await staffAuditActions(depotAId)).toContain('PASSWORD_RESET');

    await request(server)
      .post(`${api}/auth/login`)
      .send({ identifier: staffEmail, password: staffPassword })
      .expect(401);

    staffTempTokens = await login(staffEmail, 'Temporary2');
    expect(staffTempTokens.user.mustChangePassword).toBe(true);
  });

  it('lets the staff member change their own password and clears must_change_password', async () => {
    await request(server)
      .post(`${api}/auth/change-password`)
      .set(auth(staffTempTokens.accessToken))
      .send({ currentPassword: 'Temporary2', newPassword: 'StaffPass456' })
      .expect(200);

    expect(await staffAuditActions(depotAId)).toContain('PASSWORD_CHANGED');

    await request(server)
      .post(`${api}/auth/login`)
      .send({ identifier: staffEmail, password: 'Temporary2' })
      .expect(401);

    const relogin = await login(staffEmail, 'StaffPass456');
    expect(relogin.user.mustChangePassword).toBe(false);
  });

  it('rejects a password change with a wrong current password or weak new password', async () => {
    await request(server)
      .post(`${api}/auth/change-password`)
      .set(auth(ownerATokens.accessToken))
      .send({ currentPassword: 'WrongPassword1', newPassword: 'OwnerPass999' })
      .expect(400);

    await request(server)
      .post(`${api}/auth/change-password`)
      .set(auth(ownerATokens.accessToken))
      .send({ currentPassword: ownerPassword, newPassword: 'weak' })
      .expect(400);

    await request(server).post(`${api}/auth/change-password`).expect(401);
  });

  it('reads and updates depot settings as the owner', async () => {
    const initial = await request(server)
      .get(`${api}/depot/settings`)
      .set(auth(ownerATokens.accessToken))
      .expect(200);

    expect(initial.body).toMatchObject({
      id: depotAId,
      name: 'Staff Depot A',
      currency: 'KHR',
      locale: 'EN',
    });

    const updated = await request(server)
      .patch(`${api}/depot/settings`)
      .set(auth(ownerATokens.accessToken))
      .send({
        address: 'Street 271, Phnom Penh',
        currency: 'USD',
        locale: 'KM',
        invoiceFooter: 'Thank you for your business.',
      })
      .expect(200);

    expect(updated.body).toMatchObject({
      id: depotAId,
      address: 'Street 271, Phnom Penh',
      currency: 'USD',
      locale: 'KM',
      invoiceFooter: 'Thank you for your business.',
    });
    expect(await staffAuditActions(depotAId)).toContain('DEPOT_SETTINGS_UPDATED');
  });

  it('lets staff read settings but not update them', async () => {
    const staffLogin = await login(staffEmail, 'StaffPass456');

    await request(server)
      .get(`${api}/depot/settings`)
      .set(auth(staffLogin.accessToken))
      .expect(200);

    await request(server)
      .patch(`${api}/depot/settings`)
      .set(auth(staffLogin.accessToken))
      .send({ name: 'Staff Renamed Depot' })
      .expect(403);
  });

  it('validates depot settings input', async () => {
    await request(server)
      .patch(`${api}/depot/settings`)
      .set(auth(ownerATokens.accessToken))
      .send({ currency: 'US' })
      .expect(400);

    await request(server)
      .patch(`${api}/depot/settings`)
      .set(auth(ownerATokens.accessToken))
      .send({ locale: 'FR' })
      .expect(400);

    await request(server)
      .patch(`${api}/depot/settings`)
      .set(auth(ownerATokens.accessToken))
      .send({})
      .expect(400);
  });

  it('keeps depot B settings independent from depot A', async () => {
    const response = await request(server)
      .get(`${api}/depot/settings`)
      .set(auth(ownerBTokens.accessToken))
      .expect(200);

    expect(response.body).toMatchObject({
      id: depotBId,
      name: 'Staff Depot B',
      currency: 'KHR',
      locale: 'EN',
    });
    expect((response.body as SettingsView).address).toBeNull();
  });

  it('enforces the plan user limit when creating staff', async () => {
    const response = await request(server)
      .post(`${api}/users`)
      .set(auth(ownerCTokens.accessToken))
      .send({
        name: 'Over Limit',
        email: `over-limit-${runId}@example.com`,
        role: 'SALES',
        password: staffPassword,
      })
      .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      details: { reason: 'PLAN_USER_LIMIT_REACHED', maxUsers: 1, activeUsers: 1 },
    });
    expect(response.body.message).toContain('allows at most 1 active user');
  });

  it('rejects a duplicate staff email with 409', async () => {
    await request(server)
      .post(`${api}/users`)
      .set(auth(ownerATokens.accessToken))
      .send({
        name: 'Duplicate Staff',
        email: staffEmail,
        role: 'DELIVERY',
        password: staffPassword,
      })
      .expect(409);
  });
});
