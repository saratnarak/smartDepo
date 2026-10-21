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
  depot: { id: string; name: string; status: string } | null;
}

interface UnitView {
  id: string;
  name: string;
  conversionFactor: string;
  isBaseUnit: boolean;
}

interface ProductView {
  id: string;
  sku: string;
  name: string;
  baseUnit: UnitView;
  units: UnitView[];
  currentStock: string;
  costPrice: string;
}

interface CustomerView {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  isWalkIn: boolean;
  balance: string;
  creditLimit: string | null;
  paymentTermDays: number | null;
}

interface InvoiceLineView {
  productId: string;
  quantity: string;
  quantityBase: string;
  quantityReadable: string;
  unitPrice: string;
  discountAmount: string;
  lineTotal: string;
  costPerBaseUnit: string | null;
  batches: Array<{ batchNumber: string; quantity: string }>;
}

interface InvoiceView {
  id: string;
  invoiceNumber: string;
  status: string;
  paymentStatus: string;
  customerId: string;
  subtotal: string;
  discountTotal: string;
  total: string;
  outstanding: string;
  paidAmount: string;
  refundDue: string;
  dueDate: string | null;
  creditLimitWarning: string | null;
  items: InvoiceLineView[];
  payments: Array<{ id: string; amount: string; method: string }>;
}

interface PaymentView {
  id: string;
  amount: string;
  allocatedAmount: string;
  unallocatedAmount: string;
  method: string;
  allocations: Array<{ invoiceId: string; invoiceNumber: string; amount: string }>;
}

describe('Customers, invoices, payments, and credit (database)', () => {
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
  let depotBId: string;
  let ownerATokens: LoginResponse;
  let ownerBTokens: LoginResponse;
  let salesTokens: LoginResponse;
  let keeperTokens: LoginResponse;

  let productId: string;
  let bottleUnitId: string;
  let trackedProductId: string;
  let trackedSackUnitId: string;
  let concurrencyProductId: string;
  let concurrencyUnitId: string;
  let supplierId: string;
  let retailCustomerId: string;
  let wholesaleCustomerId: string;

  const phoneSuffix = String(
    [...runId].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) % 100_000_000, 11),
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
    const email = `sales-${role.toLowerCase()}-${runId}@example.com`;
    await request(server)
      .post(`${api}/users`)
      .set(auth(ownerATokens.accessToken))
      .send({ name, email, phone: uniquePhone(role.length + 20), role, password: staffPassword })
      .expect(201);

    return email;
  }

  async function createProduct(input: {
    sku: string;
    name: string;
    trackBatches?: boolean;
    baseUnit: string;
    units: Array<{ name: string; conversionFactor: string }>;
    retailPrice?: string;
    wholesalePrice?: string;
  }): Promise<ProductView> {
    const response = await request(server)
      .post(`${api}/products`)
      .set(auth(ownerATokens.accessToken))
      .send({
        sku: input.sku,
        name: input.name,
        trackBatches: input.trackBatches ?? false,
        baseUnit: input.baseUnit,
        units: input.units,
      })
      .expect(201);

    const product = response.body as ProductView;
    const units = [product.baseUnit, ...product.units.filter((unit) => !unit.isBaseUnit)];

    for (const [type, amount] of [
      ['RETAIL', input.retailPrice],
      ['WHOLESALE', input.wholesalePrice],
    ] as const) {
      if (amount === undefined) {
        continue;
      }

      for (const unit of units) {
        await request(server)
          .put(`${api}/products/${product.id}/units/${unit.id}/prices/${type}`)
          .set(auth(ownerATokens.accessToken))
          .send({ amount })
          .expect(200);
      }
    }

    return product;
  }

  async function adjustStock(productId: string, unitId: string, quantity: string): Promise<void> {
    await request(server)
      .post(`${api}/stock/adjustments`)
      .set(auth(keeperTokens.accessToken))
      .send({ productId, unitId, quantity, reason: 'Opening stock for the sales test' })
      .expect(200);
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

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    adminEmail = `sales-admin-${runId}@example.com`;
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
      'Sales Depot A',
      `sales-a-${runId}@example.com`,
      uniquePhone(1),
    );
    depotAId = depotA.depot.id;
    await approveDepot(depotAId);
    ownerATokens = await login(`sales-a-${runId}@example.com`, ownerPassword);

    const keeperEmail = await createStaff('Keeper A', 'STOCK_KEEPER');
    keeperTokens = await login(keeperEmail, staffPassword);

    const salesEmail = await createStaff('Sales A', 'SALES');
    salesTokens = await login(salesEmail, staffPassword);

    const depotB = await registerDepot(
      'Sales Depot B',
      `sales-b-${runId}@example.com`,
      uniquePhone(2),
    );
    depotBId = depotB.depot.id;
    await approveDepot(depotBId);
    ownerBTokens = await login(`sales-b-${runId}@example.com`, ownerPassword);

    const product = await createProduct({
      sku: 'BEER-001',
      name: 'ABC Beer 330ml',
      baseUnit: 'bottle',
      units: [{ name: 'carton', conversionFactor: '24' }],
      retailPrice: '1.50',
      wholesalePrice: '1.20',
    });
    productId = product.id;
    bottleUnitId = product.baseUnit.id;

    const tracked = await createProduct({
      sku: 'RICE-001',
      name: 'Tracked Rice',
      trackBatches: true,
      baseUnit: 'kg',
      units: [{ name: 'sack', conversionFactor: '50' }],
      retailPrice: '2.00',
      wholesalePrice: '1.80',
    });
    trackedProductId = tracked.id;
    trackedSackUnitId = tracked.units.find((unit) => unit.name === 'sack')?.id ?? '';

    const concurrency = await createProduct({
      sku: 'LAST-001',
      name: 'Last Bottle',
      baseUnit: 'bottle',
      units: [],
      retailPrice: '2.00',
      wholesalePrice: '1.80',
    });
    concurrencyProductId = concurrency.id;
    concurrencyUnitId = concurrency.baseUnit.id;

    const supplier = await request(server)
      .post(`${api}/suppliers`)
      .set(auth(keeperTokens.accessToken))
      .send({ name: `Sales Supplier ${runId}` })
      .expect(201);
    supplierId = (supplier.body as { id: string }).id;

    const retail = await request(server)
      .post(`${api}/customers`)
      .set(auth(salesTokens.accessToken))
      .send({
        name: `Retail Customer ${runId}`,
        phone: uniquePhone(3),
        type: 'RETAIL',
        paymentTermDays: 0,
      })
      .expect(201);
    retailCustomerId = (retail.body as CustomerView).id;

    const wholesale = await request(server)
      .post(`${api}/customers`)
      .set(auth(salesTokens.accessToken))
      .send({
        name: `Wholesale Customer ${runId}`,
        type: 'WHOLESALE',
        creditLimit: '1000.00',
        paymentTermDays: 30,
      })
      .expect(201);
    wholesaleCustomerId = (wholesale.body as CustomerView).id;

    await adjustStock(productId, bottleUnitId, '100');
    await adjustStock(concurrencyProductId, concurrencyUnitId, '10');
  });

  afterAll(async () => {
    await app.close();
  });

  it('protects the customer, invoice, payment, and credit endpoints', async () => {
    await request(server).get(`${api}/customers`).expect(401);
    await request(server).get(`${api}/invoices`).expect(401);
    await request(server).get(`${api}/payments`).expect(401);
    await request(server).get(`${api}/credit/overview`).expect(401);

    // The stock keeper has no access to sales data.
    await request(server).get(`${api}/customers`).set(auth(keeperTokens.accessToken)).expect(403);
    await request(server).get(`${api}/invoices`).set(auth(keeperTokens.accessToken)).expect(403);
    await request(server).get(`${api}/payments`).set(auth(keeperTokens.accessToken)).expect(403);
    await request(server)
      .get(`${api}/credit/overview`)
      .set(auth(keeperTokens.accessToken))
      .expect(403);

    // Sales can work with customers, invoices, payments, and credit, but cannot void.
    await request(server).get(`${api}/customers`).set(auth(salesTokens.accessToken)).expect(200);
    await request(server).get(`${api}/invoices`).set(auth(salesTokens.accessToken)).expect(200);
    await request(server).get(`${api}/payments`).set(auth(salesTokens.accessToken)).expect(200);
    await request(server)
      .get(`${api}/credit/overview`)
      .set(auth(salesTokens.accessToken))
      .expect(200);
    await request(server)
      .post(`${api}/invoices/${randomUUID()}/void`)
      .set(auth(salesTokens.accessToken))
      .send({ reason: 'Sales must not void' })
      .expect(403);
  });

  it('creates, edits, lists, and archives customers with a walk-in customer', async () => {
    const created = await request(server)
      .post(`${api}/customers`)
      .set(auth(salesTokens.accessToken))
      .send({
        name: `Restaurant ${runId}`,
        phone: uniquePhone(4),
        address: 'Street 271, Phnom Penh',
        type: 'RETAIL',
        creditLimit: '250.00',
        paymentTermDays: 14,
        notes: 'Delivers on Friday',
      })
      .expect(201);
    const customer = created.body as CustomerView;

    expect(customer).toMatchObject({
      name: `Restaurant ${runId}`,
      type: 'RETAIL',
      isActive: true,
      isWalkIn: false,
      balance: '0.00',
      creditLimit: '250.00',
      paymentTermDays: 14,
    });

    const updated = await request(server)
      .patch(`${api}/customers/${customer.id}`)
      .set(auth(salesTokens.accessToken))
      .send({ contactName: undefined, notes: 'Pays in cash' } as Record<string, unknown>)
      .expect(200);
    expect(updated.body).toMatchObject({ notes: 'Pays in cash' });

    await request(server)
      .post(`${api}/customers`)
      .set(auth(salesTokens.accessToken))
      .send({ name: '' })
      .expect(400);
    await request(server)
      .post(`${api}/customers`)
      .set(auth(salesTokens.accessToken))
      .send({ name: `Bad ${runId}`, email: 'not-an-email' })
      .expect(400);
    await request(server)
      .post(`${api}/customers`)
      .set(auth(salesTokens.accessToken))
      .send({ name: `Bad ${runId}`, creditLimit: '-5' })
      .expect(400);

    const list = await request(server)
      .get(`${api}/customers`)
      .set(auth(salesTokens.accessToken))
      .query({ search: 'Walk-in' })
      .expect(200);
    const walkIn = (list.body as { data: CustomerView[] }).data[0];
    expect(walkIn).toMatchObject({ name: 'Walk-in', isWalkIn: true });

    await request(server)
      .post(`${api}/customers/${walkIn.id}/archive`)
      .set(auth(salesTokens.accessToken))
      .expect(400);

    const archived = await request(server)
      .post(`${api}/customers/${customer.id}/archive`)
      .set(auth(salesTokens.accessToken))
      .expect(200);
    expect(archived.body).toMatchObject({ isActive: false });

    expect(await auditActions(depotAId)).toEqual(
      expect.arrayContaining(['CUSTOMER_CREATED', 'CUSTOMER_UPDATED', 'CUSTOMER_ARCHIVED']),
    );
  });

  it('creates an invoice with the price of the customer type and deducts the stock', async () => {
    const response = await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: retailCustomerId,
        lines: [{ productId, unitId: bottleUnitId, quantity: '10' }],
      })
      .expect(201);

    const invoice = response.body as InvoiceView;

    expect(invoice).toMatchObject({
      invoiceNumber: 'INV-000001',
      status: 'COMPLETED',
      paymentStatus: 'UNPAID',
      subtotal: '15.00',
      discountTotal: '0.00',
      total: '15.00',
      outstanding: '15.00',
      paidAmount: '0.00',
      refundDue: '0.00',
    });
    expect(invoice.items[0]).toMatchObject({
      quantity: '10',
      quantityBase: '10',
      unitPrice: '1.50',
      lineTotal: '15.00',
    });

    const product = await request(server)
      .get(`${api}/products/${productId}`)
      .set(auth(salesTokens.accessToken))
      .expect(200);
    expect(product.body).toMatchObject({ currentStock: '90' });

    const stock = await request(server)
      .get(`${api}/stock`)
      .set(auth(salesTokens.accessToken))
      .query({ search: 'BEER-001' })
      .expect(200);
    expect((stock.body as { data: Array<{ currentStock: string }> }).data[0].currentStock).toBe(
      '90',
    );

    expect(await auditActions(depotAId)).toContain('INVOICE_CREATED');
  });

  it('uses the wholesale price for a wholesale customer', async () => {
    const response = await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: wholesaleCustomerId,
        lines: [{ productId, unitId: bottleUnitId, quantity: '10' }],
      })
      .expect(201);

    const invoice = response.body as InvoiceView;

    expect(invoice).toMatchObject({ subtotal: '12.00', total: '12.00' });

    // The due date comes from the payment terms of the customer.
    const dueDate = new Date(invoice.dueDate ?? 0).getTime();
    const days = Math.round((dueDate - Date.now()) / (24 * 60 * 60 * 1000));
    expect(days).toBeGreaterThanOrEqual(29);
    expect(days).toBeLessThanOrEqual(30);
  });

  it('warns or blocks when an invoice goes past the credit limit of a customer', async () => {
    const customer = await request(server)
      .post(`${api}/customers`)
      .set(auth(salesTokens.accessToken))
      .send({ name: `Limited Customer ${runId}`, type: 'RETAIL', creditLimit: '10.00' })
      .expect(201);
    const customerId = (customer.body as CustomerView).id;

    const warned = await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId,
        lines: [{ productId, unitId: bottleUnitId, quantity: '20' }],
      })
      .expect(201);

    expect((warned.body as InvoiceView).creditLimitWarning).toContain('credit limit');

    await request(server)
      .patch(`${api}/depot/settings`)
      .set(auth(ownerATokens.accessToken))
      .send({ creditLimitMode: 'BLOCK' })
      .expect(200);

    await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId,
        lines: [{ productId, unitId: bottleUnitId, quantity: '1' }],
      })
      .expect(400);

    await request(server)
      .patch(`${api}/depot/settings`)
      .set(auth(ownerATokens.accessToken))
      .send({ creditLimitMode: 'WARN' })
      .expect(200);

    // Only the owner may change the credit setting.
    await request(server)
      .patch(`${api}/depot/settings`)
      .set(auth(salesTokens.accessToken))
      .send({ creditLimitMode: 'BLOCK' })
      .expect(403);
  });

  it('lets only the owner override a price', async () => {
    await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: retailCustomerId,
        lines: [{ productId, unitId: bottleUnitId, quantity: '1', unitPrice: '1.00' }],
      })
      .expect(403);

    const response = await request(server)
      .post(`${api}/invoices`)
      .set(auth(ownerATokens.accessToken))
      .send({
        customerId: retailCustomerId,
        lines: [{ productId, unitId: bottleUnitId, quantity: '1', unitPrice: '1.00' }],
      })
      .expect(201);

    expect((response.body as InvoiceView).total).toBe('1.00');
  });

  it('applies a line discount and an invoice discount', async () => {
    const response = await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: retailCustomerId,
        discount: { type: 'PERCENT', value: '10' },
        lines: [
          {
            productId,
            unitId: bottleUnitId,
            quantity: '10',
            discount: { type: 'PERCENT', value: '10' },
          },
        ],
      })
      .expect(201);

    const invoice = response.body as InvoiceView;

    expect(invoice.items[0]).toMatchObject({
      unitPrice: '1.50',
      discountAmount: '1.50',
      lineTotal: '13.50',
    });
    expect(invoice).toMatchObject({
      subtotal: '13.50',
      discountTotal: '1.35',
      total: '12.15',
    });
  });

  it('rejects invalid invoices', async () => {
    await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: retailCustomerId,
        lines: [{ productId, unitId: bottleUnitId, quantity: '0' }],
      })
      .expect(400);

    await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: randomUUID(),
        lines: [{ productId, unitId: bottleUnitId, quantity: '1' }],
      })
      .expect(404);

    await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: retailCustomerId,
        lines: [{ productId: randomUUID(), unitId: bottleUnitId, quantity: '1' }],
      })
      .expect(404);
  });

  it('applies a payment that was taken at the checkout', async () => {
    const response = await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: retailCustomerId,
        lines: [{ productId, unitId: bottleUnitId, quantity: '4' }],
        payment: { amount: '6.00', method: 'CASH', reference: 'Cash at the counter' },
      })
      .expect(201);

    const invoice = response.body as InvoiceView;

    expect(invoice).toMatchObject({
      total: '6.00',
      paidAmount: '6.00',
      outstanding: '0.00',
      paymentStatus: 'PAID',
    });
    expect(invoice.payments).toHaveLength(1);
    expect(invoice.payments[0]).toMatchObject({ amount: '6.00', method: 'CASH' });
  });

  it('returns the same invoice when the same idempotency key is used twice', async () => {
    const key = `invoice-key-${runId}`;
    const body = {
      customerId: retailCustomerId,
      idempotencyKey: key,
      lines: [{ productId, unitId: bottleUnitId, quantity: '2' }],
    };

    const first = await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send(body)
      .expect(201);
    const second = await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send(body)
      .expect(201);

    const firstInvoice = first.body as InvoiceView;
    const secondInvoice = second.body as InvoiceView;

    expect(secondInvoice.id).toBe(firstInvoice.id);
    expect(secondInvoice.invoiceNumber).toBe(firstInvoice.invoiceNumber);

    const list = await request(server)
      .get(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .query({ search: firstInvoice.invoiceNumber })
      .expect(200);
    expect((list.body as { meta: { total: number } }).meta.total).toBe(1);
  });

  it('sells the last stock only once when two invoices race for it', async () => {
    const body = {
      customerId: retailCustomerId,
      lines: [{ productId: concurrencyProductId, unitId: concurrencyUnitId, quantity: '10' }],
    };

    const [first, second] = await Promise.all([
      request(server).post(`${api}/invoices`).set(auth(salesTokens.accessToken)).send(body),
      request(server).post(`${api}/invoices`).set(auth(salesTokens.accessToken)).send(body),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 400]);

    const product = await request(server)
      .get(`${api}/products/${concurrencyProductId}`)
      .set(auth(salesTokens.accessToken))
      .expect(200);
    expect(product.body).toMatchObject({ currentStock: '0' });
  });

  it('gives every invoice its own number when two invoices are created at the same time', async () => {
    const body = {
      customerId: retailCustomerId,
      lines: [{ productId, unitId: bottleUnitId, quantity: '1' }],
    };

    const [first, second] = await Promise.all([
      request(server).post(`${api}/invoices`).set(auth(salesTokens.accessToken)).send(body),
      request(server).post(`${api}/invoices`).set(auth(salesTokens.accessToken)).send(body),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const firstNumber = (first.body as InvoiceView).invoiceNumber;
    const secondNumber = (second.body as InvoiceView).invoiceNumber;

    expect(firstNumber).not.toBe(secondNumber);
    expect(firstNumber).toMatch(/^INV-\d{6}$/);

    const list = await request(server)
      .get(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .query({ pageSize: 100 })
      .expect(200);
    const numbers = (list.body as { data: InvoiceView[] }).data.map(
      (invoice) => invoice.invoiceNumber,
    );

    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('sells batch-tracked stock from the earliest unexpired batch', async () => {
    const expiry = (days: number) =>
      new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const firstPurchase = await request(server)
      .post(`${api}/purchases`)
      .set(auth(keeperTokens.accessToken))
      .send({
        supplierId,
        lines: [
          {
            productId: trackedProductId,
            unitId: trackedSackUnitId,
            quantity: '2',
            unitCost: '80.00',
            batchNumber: 'LOT-NEAR',
            expiryDate: expiry(30),
          },
        ],
      })
      .expect(201);
    await request(server)
      .post(`${api}/purchases/${(firstPurchase.body as { id: string }).id}/receive`)
      .set(auth(keeperTokens.accessToken))
      .expect(200);

    const expiredPurchase = await request(server)
      .post(`${api}/purchases`)
      .set(auth(keeperTokens.accessToken))
      .send({
        supplierId,
        lines: [
          {
            productId: trackedProductId,
            unitId: trackedSackUnitId,
            quantity: '1',
            unitCost: '80.00',
            batchNumber: 'LOT-EXPIRED',
            expiryDate: expiry(-5),
          },
        ],
      })
      .expect(201);
    await request(server)
      .post(`${api}/purchases/${(expiredPurchase.body as { id: string }).id}/receive`)
      .set(auth(keeperTokens.accessToken))
      .expect(200);

    const response = await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: retailCustomerId,
        lines: [{ productId: trackedProductId, unitId: trackedSackUnitId, quantity: '2' }],
      })
      .expect(201);

    const invoice = response.body as InvoiceView;

    expect(invoice.items[0].quantityBase).toBe('100');
    expect(invoice.items[0].batches).toEqual([
      expect.objectContaining({ batchNumber: 'LOT-NEAR', quantity: '100' }),
    ]);

    await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: retailCustomerId,
        lines: [{ productId: trackedProductId, unitId: trackedSackUnitId, quantity: '5' }],
      })
      .expect(400);
  });

  it('records a payment and allocates it to the oldest invoice', async () => {
    const response = await request(server)
      .post(`${api}/payments`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: retailCustomerId,
        amount: '5.00',
        method: 'BANK_TRANSFER',
        reference: 'Transfer 001',
      })
      .expect(201);

    const payment = response.body as PaymentView;

    expect(payment).toMatchObject({
      amount: '5.00',
      allocatedAmount: '5.00',
      unallocatedAmount: '0.00',
      method: 'BANK_TRANSFER',
    });
    expect(payment.allocations).toHaveLength(1);

    const invoice = await request(server)
      .get(`${api}/invoices/${payment.allocations[0].invoiceId}`)
      .set(auth(salesTokens.accessToken))
      .expect(200);
    expect(invoice.body).toMatchObject({ paymentStatus: 'PARTIAL' });

    expect(await auditActions(depotAId)).toContain('PAYMENT_RECORDED');
  });

  it('rejects payments that are allocated too much', async () => {
    const invoices = await request(server)
      .get(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .query({ customerId: retailCustomerId, paymentStatus: 'UNPAID' })
      .expect(200);
    const invoice = (invoices.body as { data: InvoiceView[] }).data[0];

    await request(server)
      .post(`${api}/payments`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: retailCustomerId,
        amount: '10.00',
        method: 'CASH',
        allocations: [{ invoiceId: invoice.id, amount: '50.00' }],
      })
      .expect(400);

    await request(server)
      .post(`${api}/payments`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: retailCustomerId,
        amount: '5.00',
        method: 'CASH',
        allocations: [
          { invoiceId: invoice.id, amount: '4.00' },
          { invoiceId: invoice.id, amount: '4.00' },
        ],
      })
      .expect(400);

    await request(server)
      .post(`${api}/payments`)
      .set(auth(salesTokens.accessToken))
      .send({ customerId: retailCustomerId, amount: '0', method: 'CASH' })
      .expect(400);
  });

  it('voids an invoice for the owner and returns the stock', async () => {
    const before = await request(server)
      .get(`${api}/products/${productId}`)
      .set(auth(salesTokens.accessToken))
      .expect(200);
    const stockBefore = (before.body as ProductView).currentStock;

    const created = await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: retailCustomerId,
        lines: [{ productId, unitId: bottleUnitId, quantity: '3' }],
      })
      .expect(201);
    const invoice = created.body as InvoiceView;

    const voided = await request(server)
      .post(`${api}/invoices/${invoice.id}/void`)
      .set(auth(ownerATokens.accessToken))
      .send({ reason: 'Customer returned the beer' })
      .expect(200);

    expect(voided.body).toMatchObject({
      status: 'VOIDED',
      voidReason: 'Customer returned the beer',
    });

    const after = await request(server)
      .get(`${api}/products/${productId}`)
      .set(auth(salesTokens.accessToken))
      .expect(200);
    // The invoice took three bottles out of the stock and the void gives them back.
    expect(Number((after.body as ProductView).currentStock)).toBe(Number(stockBefore));

    await request(server)
      .post(`${api}/payments`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: retailCustomerId,
        amount: '5.00',
        method: 'CASH',
        allocations: [{ invoiceId: invoice.id, amount: '5.00' }],
      })
      .expect(400);

    expect(await auditActions(depotAId)).toContain('INVOICE_VOIDED');
  });

  it('shows the credit overview, the ageing, and the customer statement', async () => {
    const created = await request(server)
      .post(`${api}/invoices`)
      .set(auth(salesTokens.accessToken))
      .send({
        customerId: retailCustomerId,
        lines: [{ productId, unitId: bottleUnitId, quantity: '2' }],
      })
      .expect(201);
    const invoice = created.body as InvoiceView;

    await prisma.runAsTenant(
      { depotId: depotAId, role: 'SALES', userId: salesTokens.user.id },
      async (transaction) => {
        await transaction.salesOrder.update({
          where: { id: invoice.id },
          data: { dueDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
        });
      },
    );

    const overview = await request(server)
      .get(`${api}/credit/overview`)
      .set(auth(salesTokens.accessToken))
      .expect(200);
    expect(
      Number((overview.body as { totalOutstanding: string }).totalOutstanding),
    ).toBeGreaterThan(0);
    expect((overview.body as { ageing: Array<{ key: string }> }).ageing.map((b) => b.key)).toEqual([
      '0-30',
      '31-60',
      'OVER_60',
    ]);

    const overdue = await request(server)
      .get(`${api}/credit/overdue`)
      .set(auth(salesTokens.accessToken))
      .expect(200);
    expect(
      (overdue.body as { data: Array<{ invoiceNumber: string; daysOverdue: number }> }).data[0],
    ).toMatchObject({ invoiceNumber: invoice.invoiceNumber, daysOverdue: 40 });

    const statement = await request(server)
      .get(`${api}/customers/${retailCustomerId}/statement`)
      .set(auth(salesTokens.accessToken))
      .expect(200);
    const statementBody = statement.body as {
      lines: Array<{ type: string; debit: string; credit: string; balance: string }>;
      closingBalance: string;
    };
    expect(statementBody.lines.some((line) => line.type === 'INVOICE')).toBe(true);
    expect(statementBody.lines.some((line) => line.type === 'PAYMENT')).toBe(true);
    expect(Number(statementBody.closingBalance)).toBeGreaterThan(0);
  });

  it('does not let one depot invoice another depot customer, product, or payment', async () => {
    const customerB = await request(server)
      .post(`${api}/customers`)
      .set(auth(ownerBTokens.accessToken))
      .send({ name: `Depot B Customer ${runId}` })
      .expect(201);
    const customerBId = (customerB.body as CustomerView).id;

    const productB = await request(server)
      .post(`${api}/products`)
      .set(auth(ownerBTokens.accessToken))
      .send({ sku: 'B-001', name: 'Depot B Product', baseUnit: 'bottle', units: [] })
      .expect(201);
    const productBId = (productB.body as ProductView).id;

    await request(server)
      .get(`${api}/customers/${customerBId}`)
      .set(auth(ownerATokens.accessToken))
      .expect(404);

    await request(server)
      .post(`${api}/invoices`)
      .set(auth(ownerATokens.accessToken))
      .send({
        customerId: customerBId,
        lines: [{ productId, unitId: bottleUnitId, quantity: '1' }],
      })
      .expect(404);

    await request(server)
      .post(`${api}/invoices`)
      .set(auth(ownerATokens.accessToken))
      .send({
        customerId: retailCustomerId,
        lines: [{ productId: productBId, unitId: bottleUnitId, quantity: '1' }],
      })
      .expect(404);

    await request(server)
      .post(`${api}/payments`)
      .set(auth(ownerATokens.accessToken))
      .send({ customerId: customerBId, amount: '10.00', method: 'CASH' })
      .expect(404);
  });
});
