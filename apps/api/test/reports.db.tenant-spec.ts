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

interface ProductView {
  id: string;
  sku: string;
  name: string;
  baseUnit: { id: string; name: string };
  units: Array<{ id: string; name: string }>;
}

interface CustomerView {
  id: string;
  name: string;
  type: string;
  balance: string;
}

interface InvoiceView {
  id: string;
  invoiceNumber: string;
  total: string;
  paymentStatus: string;
  outstanding: string;
}

describe('Reports, dashboard, and platform data (database)', () => {
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
  let ownerATokens: LoginResponse;
  let ownerBTokens: LoginResponse;
  let salesTokens: LoginResponse;
  let keeperTokens: LoginResponse;

  let productId: string;
  let bottleUnitId: string;
  let customerRetailId: string;
  let customerWholesaleId: string;

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

    const adminEmail = `reports-admin-${runId}@example.com`;
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

    const depotA = await registerDepot(
      'Reports Depot A',
      `reports-a-${runId}@example.com`,
      uniquePhone(1),
    );
    depotAId = depotA.depot.id;
    await request(server)
      .post(`${api}/platform/depots/${depotAId}/approve`)
      .set(auth(adminToken))
      .expect(200);
    ownerATokens = await login(`reports-a-${runId}@example.com`, ownerPassword);

    const salesEmail = `reports-sales-${runId}@example.com`;
    await request(server)
      .post(`${api}/users`)
      .set(auth(ownerATokens.accessToken))
      .send({
        name: 'Sales A',
        email: salesEmail,
        phone: uniquePhone(2),
        role: 'SALES',
        password: staffPassword,
      })
      .expect(201);
    salesTokens = await login(salesEmail, staffPassword);

    const keeperEmail = `reports-keeper-${runId}@example.com`;
    await request(server)
      .post(`${api}/users`)
      .set(auth(ownerATokens.accessToken))
      .send({
        name: 'Keeper A',
        email: keeperEmail,
        phone: uniquePhone(3),
        role: 'STOCK_KEEPER',
        password: staffPassword,
      })
      .expect(201);
    keeperTokens = await login(keeperEmail, staffPassword);

    const depotB = await registerDepot(
      'Reports Depot B',
      `reports-b-${runId}@example.com`,
      uniquePhone(4),
    );
    depotBId = depotB.depot.id;
    await request(server)
      .post(`${api}/platform/depots/${depotBId}/approve`)
      .set(auth(adminToken))
      .expect(200);
    ownerBTokens = await login(`reports-b-${runId}@example.com`, ownerPassword);

    // One product with a retail price of 2.00 and a wholesale price of 1.50 per bottle.
    const product = await request(server)
      .post(`${api}/products`)
      .set(auth(ownerATokens.accessToken))
      .send({
        sku: 'REPORT-001',
        name: 'Report Beer',
        reorderLevel: '50',
        baseUnit: 'bottle',
        units: [{ name: 'carton', conversionFactor: '24' }],
      })
      .expect(201);
    const productView = product.body as ProductView;
    productId = productView.id;
    bottleUnitId = productView.baseUnit.id;

    for (const [type, amount] of [
      ['RETAIL', '2.00'],
      ['WHOLESALE', '1.50'],
    ] as const) {
      await request(server)
        .put(`${api}/products/${productId}/units/${bottleUnitId}/prices/${type}`)
        .set(auth(ownerATokens.accessToken))
        .send({ amount })
        .expect(200);
    }

    // A purchase of 100 bottles at 1.00 gives the product its cost price and its stock.
    const supplier = await request(server)
      .post(`${api}/suppliers`)
      .set(auth(ownerATokens.accessToken))
      .send({ name: `Report Supplier ${runId}` })
      .expect(201);
    const supplierId = (supplier.body as { id: string }).id;

    const purchase = await request(server)
      .post(`${api}/purchases`)
      .set(auth(ownerATokens.accessToken))
      .send({
        supplierId,
        lines: [{ productId, unitId: bottleUnitId, quantity: '100', unitCost: '1.00' }],
      })
      .expect(201);
    await request(server)
      .post(`${api}/purchases/${(purchase.body as { id: string }).id}/receive`)
      .set(auth(ownerATokens.accessToken))
      .expect(200);

    const retail = await request(server)
      .post(`${api}/customers`)
      .set(auth(ownerATokens.accessToken))
      .send({ name: `Retail Buyer ${runId}`, type: 'RETAIL' })
      .expect(201);
    customerRetailId = (retail.body as CustomerView).id;

    const wholesale = await request(server)
      .post(`${api}/customers`)
      .set(auth(ownerATokens.accessToken))
      .send({
        name: `Wholesale Buyer ${runId}`,
        type: 'WHOLESALE',
        creditLimit: '500.00',
        paymentTermDays: 30,
      })
      .expect(201);
    customerWholesaleId = (wholesale.body as CustomerView).id;

    // Invoice one: 10 bottles at the retail price of 2.00, paid in full.
    const invoiceOne = await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: customerRetailId,
        lines: [{ productId, unitId: bottleUnitId, quantity: '10' }],
        payment: { amount: '20.00', method: 'CASH' },
      })
      .expect(201);
    expect((invoiceOne.body as InvoiceView).total).toBe('20.00');

    // Invoice two: 20 bottles at the wholesale price of 1.50, left on credit.
    const invoiceTwo = await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: customerWholesaleId,
        lines: [{ productId, unitId: bottleUnitId, quantity: '20' }],
      })
      .expect(201);
    expect((invoiceTwo.body as InvoiceView).total).toBe('30.00');
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports the sales of the depot with the expected totals', async () => {
    const response = await request(server)
      .get(`${api}/reports/sales`)
      .query({ unit: 'day' })
      .set(auth(ownerATokens.accessToken))
      .expect(200);

    const body = response.body as {
      timeZone: string;
      totals: { invoiceCount: number; total: string; paid: string; outstanding: string };
    };

    expect(body.timeZone).toBe('Asia/Phnom_Penh');
    expect(body.totals.invoiceCount).toBe(2);
    expect(body.totals.total).toBe('50.00');
    expect(body.totals.paid).toBe('20.00');
    expect(body.totals.outstanding).toBe('30.00');
  });

  it('reports the sales per product, category, customer, and staff member', async () => {
    const byProduct = await request(server)
      .get(`${api}/reports/sales/by-product`)
      .set(auth(ownerATokens.accessToken))
      .expect(200);
    expect(byProduct.body).toEqual([
      expect.objectContaining({
        productId,
        quantityBase: '30',
        revenue: '50.00',
        cost: '30.00',
        profit: '20.00',
        marginPercent: '40.00',
      }),
    ]);

    const byCategory = await request(server)
      .get(`${api}/reports/sales/by-category`)
      .set(auth(ownerATokens.accessToken))
      .expect(200);
    expect((byCategory.body as Array<{ total: string }>)[0].total).toBe('50.00');

    const byCustomer = await request(server)
      .get(`${api}/reports/sales/by-customer`)
      .set(auth(ownerATokens.accessToken))
      .expect(200);
    const customers = byCustomer.body as Array<{ name: string; total: string }>;
    expect(customers).toHaveLength(2);
    expect(customers.map((row) => row.total).sort()).toEqual(['20.00', '30.00']);

    const byStaff = await request(server)
      .get(`${api}/reports/sales/by-staff`)
      .set(auth(ownerATokens.accessToken))
      .expect(200);
    expect((byStaff.body as Array<{ detail: string; total: string }>)[0]).toMatchObject({
      detail: 'SALES',
      total: '50.00',
    });
  });

  it('reports the inventory with the stock value', async () => {
    const response = await request(server)
      .get(`${api}/reports/inventory`)
      .set(auth(ownerATokens.accessToken))
      .expect(200);

    const body = response.body as {
      totalStockValue: string;
      rows: Array<{
        productId: string;
        currentStock: string;
        lowStock: boolean;
        costPerBaseUnit: string;
        stockValue: string;
      }>;
    };

    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({
      productId,
      currentStock: '70',
      lowStock: false,
      costPerBaseUnit: '1',
      stockValue: '70.00',
    });
    expect(body.totalStockValue).toBe('70.00');
  });

  it('reports the credit of every customer', async () => {
    const response = await request(server)
      .get(`${api}/reports/credit`)
      .set(auth(ownerATokens.accessToken))
      .expect(200);

    const body = response.body as {
      totalOutstanding: string;
      rows: Array<{ customerId: string; outstanding: string; paid: string }>;
    };

    expect(body.totalOutstanding).toBe('30.00');
    const wholesale = body.rows.find((row) => row.customerId === customerWholesaleId);
    expect(wholesale).toMatchObject({ outstanding: '30.00', paid: '0.00' });
  });

  it('reports the profit with the cost of the sold lines', async () => {
    const response = await request(server)
      .get(`${api}/reports/profit`)
      .set(auth(ownerATokens.accessToken))
      .expect(200);

    expect(response.body).toMatchObject({
      revenue: '50.00',
      cost: '30.00',
      profit: '20.00',
      marginPercent: '40.00',
    });
  });

  it('reports the purchases per supplier', async () => {
    const response = await request(server)
      .get(`${api}/reports/purchases`)
      .set(auth(ownerATokens.accessToken))
      .expect(200);

    expect(response.body).toMatchObject({ totalPurchases: '100.00' });
    expect(
      (response.body as { rows: Array<{ purchaseCount: number }> }).rows[0].purchaseCount,
    ).toBe(1);
  });

  it('returns the dashboard cards and the chart data', async () => {
    const response = await request(server)
      .get(`${api}/dashboard`)
      .set(auth(ownerATokens.accessToken))
      .expect(200);

    const body = response.body as {
      kpis: { monthSales: string; monthInvoiceCount: number; totalOutstandingCredit: string };
      charts: { topProductsByRevenue: Array<{ revenue: string }>; salesByWeekday: unknown[] };
    };

    expect(body.kpis.monthSales).toBe('50.00');
    expect(body.kpis.monthInvoiceCount).toBe(2);
    expect(body.kpis.totalOutstandingCredit).toBe('30.00');
    expect(body.charts.topProductsByRevenue[0].revenue).toBe('50.00');
    expect(body.charts.salesByWeekday.length).toBeGreaterThan(0);
  });

  it('exports a report as CSV', async () => {
    const response = await request(server)
      .get(`${api}/reports/sales`)
      .query({ unit: 'day', format: 'csv' })
      .set(auth(ownerATokens.accessToken))
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('Period,Invoices,Subtotal,Discount,Total,Paid,Outstanding');
  });

  it('needs a token for the reports', async () => {
    await request(server).get(`${api}/reports/sales`).expect(401);
    await request(server).get(`${api}/dashboard`).expect(401);
  });

  it('gives the sales staff only the sales summary and the stock keeper the inventory reports', async () => {
    await request(server)
      .get(`${api}/reports/sales`)
      .set(auth(salesTokens.accessToken))
      .expect(200);

    await request(server)
      .get(`${api}/reports/profit`)
      .set(auth(salesTokens.accessToken))
      .expect(403);

    await request(server)
      .get(`${api}/reports/inventory`)
      .set(auth(keeperTokens.accessToken))
      .expect(200);

    await request(server)
      .get(`${api}/reports/purchases`)
      .set(auth(keeperTokens.accessToken))
      .expect(200);

    await request(server)
      .get(`${api}/reports/profit`)
      .set(auth(keeperTokens.accessToken))
      .expect(403);

    await request(server)
      .get(`${api}/reports/credit`)
      .set(auth(keeperTokens.accessToken))
      .expect(403);
  });

  it('never shows the data of another depot', async () => {
    const sales = await request(server)
      .get(`${api}/reports/sales`)
      .set(auth(ownerBTokens.accessToken))
      .expect(200);

    expect((sales.body as { totals: { invoiceCount: number } }).totals.invoiceCount).toBe(0);

    const inventory = await request(server)
      .get(`${api}/reports/inventory`)
      .set(auth(ownerBTokens.accessToken))
      .expect(200);

    expect((inventory.body as { rows: unknown[] }).rows).toHaveLength(0);
  });

  it('gives the platform dashboard only to the platform admin', async () => {
    const response = await request(server)
      .get(`${api}/platform/dashboard`)
      .set(auth(adminToken))
      .expect(200);

    const body = response.body as {
      totalDepots: number;
      activeDepots: number;
      pendingApprovals: number;
      registeredOverTime: Array<{ period: string; registered: number }>;
      depotsByPlan: Array<{ plan: string; depots: number }>;
    };

    expect(body.totalDepots).toBeGreaterThanOrEqual(2);
    expect(body.activeDepots).toBeGreaterThanOrEqual(2);
    expect(body.pendingApprovals).toBe(0);
    expect(body.registeredOverTime.length).toBeGreaterThan(0);
    expect(body.depotsByPlan.length).toBeGreaterThan(0);

    await request(server)
      .get(`${api}/platform/dashboard`)
      .set(auth(ownerATokens.accessToken))
      .expect(403);
  });
});
