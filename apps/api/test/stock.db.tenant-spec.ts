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
  isActive: boolean;
}

interface ProductView {
  id: string;
  sku: string;
  name: string;
  reorderLevel: string;
  costPrice: string;
  trackBatches: boolean;
  baseUnit: UnitView;
  units: UnitView[];
  currentStock: string;
  currentStockReadable: string;
  lowStock: boolean;
}

interface ProductListBody {
  data: ProductView[];
  meta: { page: number; pageSize: number; total: number };
}

interface SupplierView {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  isActive: boolean;
}

interface SupplierListBody {
  data: SupplierView[];
  meta: { page: number; pageSize: number; total: number };
}

interface PurchaseLineView {
  id: string;
  productId: string;
  quantity: string;
  quantityBase: string;
  unitCost: string;
  unitCostPerBaseUnit: string;
  lineTotal: string;
  batchNumber: string | null;
}

interface PurchaseView {
  id: string;
  referenceNumber: string;
  status: string;
  subtotal: string;
  total: string;
  receivedAt: string | null;
  supplier: SupplierView;
  items: PurchaseLineView[];
}

interface StockBatchBody {
  id: string;
  batchNumber: string;
  currentStock: string;
  currentStockReadable: string;
}

interface StockItemBody extends ProductView {
  batches: StockBatchBody[];
}

interface StockListBody {
  data: StockItemBody[];
  meta: { page: number; pageSize: number; total: number };
}

interface MovementBody {
  id: string;
  type: string;
  quantity: string;
  quantityReadable: string;
  product: { id: string; name: string };
  createdBy: { id: string; name: string } | null;
}

interface MovementListBody {
  data: MovementBody[];
  meta: { page: number; pageSize: number; total: number };
}

interface BatchAlertBody {
  batchNumber: string;
  daysToExpiry: number;
  currentStock: string;
}

interface BatchAlertsBody {
  days: number;
  nearExpiry: BatchAlertBody[];
  expired: BatchAlertBody[];
}

interface PriceHistoryBody {
  data: Array<{
    oldAmount: string | null;
    newAmount: string;
    productUnitName: string;
    changedBy: { id: string; name: string } | null;
  }>;
  meta: { total: number };
}

function dateOffset(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe('Stock, suppliers, and purchases (database)', () => {
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
  let stockKeeperTokens: LoginResponse;
  let salesTokens: LoginResponse;
  let deliveryTokens: LoginResponse;

  let supplierId: string;
  let trackedProductId: string;
  let trackedCartonUnitId: string;
  let simpleProductId: string;
  let simpleBottleUnitId: string;
  let simpleCartonUnitId: string;
  let emptyProductId: string;
  let concurrentProductId: string;
  let concurrentBottleUnitId: string;
  let concurrentCartonUnitId: string;
  let receivedTrackedPurchaseId: string;
  let cancelledPurchaseId: string;

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
    const email = `stock-${role.toLowerCase()}-${runId}@example.com`;
    await request(server)
      .post(`${api}/users`)
      .set(auth(ownerATokens.accessToken))
      .send({ name, email, phone: uniquePhone(role.length + 10), role, password: staffPassword })
      .expect(201);

    return email;
  }

  async function auditActions(depotId: string): Promise<string[]> {
    const audits = await prisma.runAsPlatformAdmin(adminPrincipal, (transaction) =>
      transaction.auditLog.findMany({ where: { depotId }, orderBy: { createdAt: 'asc' } }),
    );
    return audits.map((audit) => audit.action);
  }

  async function createProduct(input: {
    sku: string;
    name: string;
    reorderLevel?: string;
    trackBatches?: boolean;
    baseUnit?: string;
    units: Array<{ name: string; conversionFactor: string }>;
  }): Promise<ProductView> {
    const response = await request(server)
      .post(`${api}/products`)
      .set(auth(ownerATokens.accessToken))
      .send(input)
      .expect(201);

    return response.body as ProductView;
  }

  async function receivePurchase(body: Record<string, unknown>): Promise<PurchaseView> {
    const draft = await request(server)
      .post(`${api}/purchases`)
      .set(auth(stockKeeperTokens.accessToken))
      .send(body)
      .expect(201);

    const purchase = draft.body as PurchaseView;

    const received = await request(server)
      .post(`${api}/purchases/${purchase.id}/receive`)
      .set(auth(stockKeeperTokens.accessToken))
      .expect(200);

    return received.body as PurchaseView;
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

    adminEmail = `stock-admin-${runId}@example.com`;
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
      'Stock Depot A',
      `stock-a-${runId}@example.com`,
      uniquePhone(1),
    );
    depotAId = depotA.depot.id;
    await approveDepot(depotAId);
    ownerATokens = await login(`stock-a-${runId}@example.com`, ownerPassword);

    const stockKeeperEmail = await createStaff('Stock Keeper A', 'STOCK_KEEPER');
    stockKeeperTokens = await login(stockKeeperEmail, staffPassword);

    const salesEmail = await createStaff('Sales A', 'SALES');
    salesTokens = await login(salesEmail, staffPassword);

    const deliveryEmail = await createStaff('Delivery A', 'DELIVERY');
    deliveryTokens = await login(deliveryEmail, staffPassword);

    const depotB = await registerDepot(
      'Stock Depot B',
      `stock-b-${runId}@example.com`,
      uniquePhone(2),
    );
    depotBId = depotB.depot.id;
    await approveDepot(depotBId);
    ownerBTokens = await login(`stock-b-${runId}@example.com`, ownerPassword);

    const supplier = await request(server)
      .post(`${api}/suppliers`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({
        name: `Purchase Supplier ${runId}`,
        contactName: 'Sopheak Chan',
        phone: uniquePhone(3),
        email: `supplier-${runId}@example.com`,
        address: 'Street 271, Phnom Penh',
        notes: 'Regular delivery',
      })
      .expect(201);
    supplierId = (supplier.body as SupplierView).id;

    const tracked = await createProduct({
      sku: 'TRACKED-001',
      name: 'Tracked Beer',
      reorderLevel: '120',
      trackBatches: true,
      baseUnit: 'bottle',
      units: [{ name: 'carton', conversionFactor: '24' }],
    });
    trackedProductId = tracked.id;
    trackedCartonUnitId = tracked.units.find((unit) => unit.name === 'carton')?.id ?? '';

    const simple = await createProduct({
      sku: 'SIMPLE-001',
      name: 'Simple Water',
      reorderLevel: '5',
      baseUnit: 'bottle',
      units: [{ name: 'carton', conversionFactor: '12' }],
    });
    simpleProductId = simple.id;
    simpleBottleUnitId = simple.baseUnit.id;
    simpleCartonUnitId = simple.units.find((unit) => unit.name === 'carton')?.id ?? '';

    const empty = await createProduct({
      sku: 'EMPTY-001',
      name: 'Empty Product',
      reorderLevel: '10',
      baseUnit: 'bag',
      units: [],
    });
    emptyProductId = empty.id;

    const concurrent = await createProduct({
      sku: 'CONCURRENT-001',
      name: 'Concurrent Product',
      reorderLevel: '1',
      baseUnit: 'bottle',
      units: [{ name: 'carton', conversionFactor: '12' }],
    });
    concurrentProductId = concurrent.id;
    concurrentBottleUnitId = concurrent.baseUnit.id;
    concurrentCartonUnitId = concurrent.units.find((unit) => unit.name === 'carton')?.id ?? '';
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication and enforces stock, supplier, and purchase roles', async () => {
    await request(server).get(`${api}/stock`).expect(401);
    await request(server).get(`${api}/suppliers`).expect(401);
    await request(server).get(`${api}/purchases`).expect(401);

    await request(server).get(`${api}/stock`).set(auth(salesTokens.accessToken)).expect(200);
    await request(server).get(`${api}/categories`).set(auth(salesTokens.accessToken)).expect(200);

    await request(server).get(`${api}/suppliers`).set(auth(salesTokens.accessToken)).expect(403);
    await request(server).get(`${api}/purchases`).set(auth(salesTokens.accessToken)).expect(403);
    await request(server)
      .post(`${api}/stock/adjustments`)
      .set(auth(salesTokens.accessToken))
      .send({
        productId: simpleProductId,
        unitId: simpleBottleUnitId,
        quantity: '1',
        reason: 'Not allowed',
      })
      .expect(403);
    await request(server).get(`${api}/stock`).set(auth(deliveryTokens.accessToken)).expect(403);
  });

  it('creates, edits, lists, and archives suppliers with audit entries', async () => {
    const created = await request(server)
      .post(`${api}/suppliers`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({
        name: `Editable Supplier ${runId}`,
        phone: uniquePhone(4),
        notes: 'Original note',
      })
      .expect(201);
    const supplier = created.body as SupplierView;

    const updated = await request(server)
      .patch(`${api}/suppliers/${supplier.id}`)
      .set(auth(ownerATokens.accessToken))
      .send({ contactName: 'New Contact', notes: null })
      .expect(200);

    expect(updated.body).toMatchObject({
      id: supplier.id,
      contactName: 'New Contact',
      notes: null,
    });

    const listed = await request(server)
      .get(`${api}/suppliers`)
      .set(auth(stockKeeperTokens.accessToken))
      .query({ search: 'Editable', isActive: 'true' })
      .expect(200);

    expect((listed.body as SupplierListBody).data.map((row) => row.id)).toContain(supplier.id);

    await request(server)
      .post(`${api}/suppliers`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({ name: `Editable Supplier ${runId}` })
      .expect(409);
    await request(server)
      .post(`${api}/suppliers`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({ name: 'Bad Email Supplier', email: 'not-an-email' })
      .expect(400);

    const archived = await request(server)
      .post(`${api}/suppliers/${supplier.id}/archive`)
      .set(auth(stockKeeperTokens.accessToken))
      .expect(200);
    expect(archived.body).toMatchObject({ id: supplier.id, isActive: false });

    expect(await auditActions(depotAId)).toEqual(
      expect.arrayContaining(['SUPPLIER_CREATED', 'SUPPLIER_UPDATED', 'SUPPLIER_ARCHIVED']),
    );
  });

  it('validates draft purchases, receives them in one transaction, and updates stock and cost', async () => {
    await request(server)
      .post(`${api}/purchases`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({
        supplierId,
        lines: [
          {
            productId: trackedProductId,
            unitId: trackedCartonUnitId,
            quantity: '12',
            unitCost: '24.00',
          },
        ],
      })
      .expect(400);

    await request(server)
      .post(`${api}/purchases`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({
        supplierId,
        lines: [
          {
            productId: trackedProductId,
            unitId: trackedCartonUnitId,
            quantity: '0',
            unitCost: '24.00',
            batchNumber: 'LOT-ZERO',
            expiryDate: dateOffset(30),
          },
        ],
      })
      .expect(400);

    const draft = await request(server)
      .post(`${api}/purchases`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({
        supplierId,
        referenceNumber: `PO-RECEIVE-${runId}`,
        notes: 'First tracked delivery',
        lines: [
          {
            productId: trackedProductId,
            unitId: trackedCartonUnitId,
            quantity: '12',
            unitCost: '24.00',
            batchNumber: 'LOT-NEAR',
            expiryDate: dateOffset(10),
          },
        ],
      })
      .expect(201);

    const purchase = draft.body as PurchaseView;
    receivedTrackedPurchaseId = purchase.id;
    expect(purchase).toMatchObject({
      status: 'DRAFT',
      subtotal: '288.00',
      total: '288.00',
      items: [
        expect.objectContaining({
          quantity: '12',
          quantityBase: '288',
          unitCost: '24.00',
          unitCostPerBaseUnit: '1.00',
          lineTotal: '288.00',
        }),
      ],
    });

    const received = await request(server)
      .post(`${api}/purchases/${purchase.id}/receive`)
      .set(auth(stockKeeperTokens.accessToken))
      .expect(200);

    expect(received.body).toMatchObject({ id: purchase.id, status: 'RECEIVED' });
    expect((received.body as PurchaseView).receivedAt).not.toBeNull();

    const product = await request(server)
      .get(`${api}/products/${trackedProductId}`)
      .set(auth(stockKeeperTokens.accessToken))
      .expect(200);

    expect(product.body).toMatchObject({
      id: trackedProductId,
      currentStock: '288',
      currentStockReadable: '12 cartons',
      lowStock: false,
      costPrice: '1.00',
    });

    const stock = await request(server)
      .get(`${api}/stock`)
      .set(auth(salesTokens.accessToken))
      .query({ search: 'TRACKED-001' })
      .expect(200);
    const stockItem = (stock.body as StockListBody).data[0];
    expect(stockItem).toMatchObject({
      id: trackedProductId,
      currentStock: '288',
      currentStockReadable: '12 cartons',
      lowStock: false,
    });
    expect(stockItem.batches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ batchNumber: 'LOT-NEAR', currentStock: '288' }),
      ]),
    );

    const movements = await request(server)
      .get(`${api}/stock/movements`)
      .set(auth(stockKeeperTokens.accessToken))
      .query({ productId: trackedProductId, type: 'PURCHASE' })
      .expect(200);
    expect((movements.body as MovementListBody).meta.total).toBe(1);
    expect((movements.body as MovementListBody).data[0]).toMatchObject({
      type: 'PURCHASE',
      quantity: '288',
      quantityReadable: '12 cartons',
      product: { id: trackedProductId },
      createdBy: { id: stockKeeperTokens.user.id },
    });

    expect(await auditActions(depotAId)).toEqual(
      expect.arrayContaining(['PURCHASE_CREATED', 'PURCHASE_RECEIVED']),
    );

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const inRange = await request(server)
      .get(`${api}/stock/movements`)
      .set(auth(stockKeeperTokens.accessToken))
      .query({ productId: trackedProductId, from: yesterday, to: new Date().toISOString() })
      .expect(200);
    expect((inRange.body as MovementListBody).meta.total).toBe(1);

    const outOfRange = await request(server)
      .get(`${api}/stock/movements`)
      .set(auth(stockKeeperTokens.accessToken))
      .query({ from: '2000-01-01T00:00:00.000Z', to: '2000-01-02T00:00:00.000Z' })
      .expect(200);
    expect((outOfRange.body as MovementListBody).meta.total).toBe(0);

    const second = await receivePurchase({
      supplierId,
      lines: [
        {
          productId: trackedProductId,
          unitId: trackedCartonUnitId,
          quantity: '1',
          unitCost: '30.00',
          batchNumber: 'LOT-EXPIRED',
          expiryDate: dateOffset(-5),
        },
      ],
    });
    expect(second.status).toBe('RECEIVED');

    const afterSecond = await request(server)
      .get(`${api}/products/${trackedProductId}`)
      .set(auth(stockKeeperTokens.accessToken))
      .expect(200);
    expect(afterSecond.body).toMatchObject({
      currentStock: '312',
      currentStockReadable: '13 cartons',
      costPrice: '1.25',
    });

    const alerts = await request(server)
      .get(`${api}/stock/batches/alerts`)
      .set(auth(stockKeeperTokens.accessToken))
      .query({ days: 30 })
      .expect(200);
    const alertBody = alerts.body as BatchAlertsBody;
    expect(alertBody.days).toBe(30);
    expect(alertBody.nearExpiry).toEqual(
      expect.arrayContaining([expect.objectContaining({ batchNumber: 'LOT-NEAR' })]),
    );
    expect(alertBody.expired).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ batchNumber: 'LOT-EXPIRED', currentStock: '24' }),
      ]),
    );
  });

  it('does not edit or cancel received purchases and cancels drafts without stock changes', async () => {
    await request(server)
      .patch(`${api}/purchases/${receivedTrackedPurchaseId}`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({ notes: 'Cannot edit received' })
      .expect(400);

    await request(server)
      .post(`${api}/purchases/${receivedTrackedPurchaseId}/cancel`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({ reason: 'Too late' })
      .expect(400);

    const draft = await request(server)
      .post(`${api}/purchases`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({
        supplierId,
        referenceNumber: `PO-CANCEL-${runId}`,
        lines: [
          {
            productId: simpleProductId,
            unitId: simpleCartonUnitId,
            quantity: '1',
            unitCost: '12.00',
          },
        ],
      })
      .expect(201);
    const purchase = draft.body as PurchaseView;
    cancelledPurchaseId = purchase.id;

    const cancelled = await request(server)
      .post(`${api}/purchases/${purchase.id}/cancel`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({ reason: 'Supplier could not deliver' })
      .expect(200);
    expect(cancelled.body).toMatchObject({ id: purchase.id, status: 'CANCELLED' });

    const stock = await request(server)
      .get(`${api}/stock`)
      .set(auth(stockKeeperTokens.accessToken))
      .query({ search: 'SIMPLE-001' })
      .expect(200);
    expect((stock.body as StockListBody).data[0]).toMatchObject({ currentStock: '0' });

    await request(server)
      .patch(`${api}/purchases/${cancelledPurchaseId}`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({ notes: 'Cannot edit cancelled' })
      .expect(400);

    expect(await auditActions(depotAId)).toContain('PURCHASE_CANCELLED');
  });

  it('adjusts and damages stock in any unit, requires a reason, and blocks negative stock', async () => {
    await receivePurchase({
      supplierId,
      lines: [
        {
          productId: simpleProductId,
          unitId: simpleCartonUnitId,
          quantity: '10',
          unitCost: '12.00',
        },
      ],
    });

    const adjusted = await request(server)
      .post(`${api}/stock/adjustments`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({
        productId: simpleProductId,
        unitId: simpleCartonUnitId,
        quantity: '2',
        reason: 'Physical count correction',
      })
      .expect(200);
    expect(adjusted.body).toMatchObject({
      type: 'ADJUSTMENT',
      quantity: '24',
      quantityReadable: '2 cartons',
      stockAfter: '144',
      stockAfterReadable: '12 cartons',
    });

    const damaged = await request(server)
      .post(`${api}/stock/damage`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({
        productId: simpleProductId,
        unitId: simpleBottleUnitId,
        quantity: '5',
        reason: 'Broken in transit',
      })
      .expect(200);
    expect(damaged.body).toMatchObject({
      type: 'DAMAGE',
      quantity: '-5',
      quantityReadable: '-5 bottles',
      stockAfter: '139',
      stockAfterReadable: '11 cartons and 7 bottles',
    });

    await request(server)
      .post(`${api}/stock/adjustments`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({
        productId: simpleProductId,
        unitId: simpleCartonUnitId,
        quantity: '-20',
        reason: 'Too much',
      })
      .expect(400);

    await request(server)
      .post(`${api}/stock/adjustments`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({
        productId: simpleProductId,
        unitId: simpleBottleUnitId,
        quantity: '0',
        reason: 'Zero is invalid',
      })
      .expect(400);

    await request(server)
      .post(`${api}/stock/adjustments`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({
        productId: simpleProductId,
        unitId: simpleBottleUnitId,
        quantity: '1',
      })
      .expect(400);

    expect(await auditActions(depotAId)).toEqual(
      expect.arrayContaining(['STOCK_ADJUSTED', 'STOCK_DAMAGE_RECORDED']),
    );

    const damageMovements = await request(server)
      .get(`${api}/stock/movements`)
      .set(auth(stockKeeperTokens.accessToken))
      .query({ productId: simpleProductId, type: 'DAMAGE' })
      .expect(200);
    expect((damageMovements.body as MovementListBody).data).toHaveLength(1);
  });

  it('returns low-stock products and adds currentStock and lowStock to the product list', async () => {
    const lowStock = await request(server)
      .get(`${api}/stock/low-stock`)
      .set(auth(salesTokens.accessToken))
      .expect(200);
    expect((lowStock.body as StockListBody).data.map((row) => row.id)).toContain(emptyProductId);

    const products = await request(server)
      .get(`${api}/products`)
      .set(auth(salesTokens.accessToken))
      .query({ search: 'EMPTY-001' })
      .expect(200);
    expect((products.body as ProductListBody).data[0]).toMatchObject({
      id: emptyProductId,
      currentStock: '0',
      lowStock: true,
    });
  });

  it('serializes concurrent negative adjustments so stock cannot go below zero', async () => {
    await receivePurchase({
      supplierId,
      lines: [
        {
          productId: concurrentProductId,
          unitId: concurrentCartonUnitId,
          quantity: '1',
          unitCost: '1.00',
        },
      ],
    });

    await request(server)
      .post(`${api}/stock/adjustments`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({
        productId: concurrentProductId,
        unitId: concurrentBottleUnitId,
        quantity: '-2',
        reason: 'Prepare concurrency test',
      })
      .expect(200);

    const [first, second] = await Promise.all([
      request(server)
        .post(`${api}/stock/adjustments`)
        .set(auth(stockKeeperTokens.accessToken))
        .send({
          productId: concurrentProductId,
          unitId: concurrentBottleUnitId,
          quantity: '-6',
          reason: 'Concurrent request one',
        }),
      request(server)
        .post(`${api}/stock/adjustments`)
        .set(auth(stockKeeperTokens.accessToken))
        .send({
          productId: concurrentProductId,
          unitId: concurrentBottleUnitId,
          quantity: '-6',
          reason: 'Concurrent request two',
        }),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 400]);

    const stock = await request(server)
      .get(`${api}/stock`)
      .set(auth(stockKeeperTokens.accessToken))
      .query({ search: 'CONCURRENT-001' })
      .expect(200);
    expect((stock.body as StockListBody).data[0].currentStock).toBe('4');
  });

  it('returns read-only price history with who, when, and old and new amounts', async () => {
    await request(server)
      .put(`${api}/products/${trackedProductId}/units/${trackedCartonUnitId}/prices/RETAIL`)
      .set(auth(ownerATokens.accessToken))
      .send({ amount: '24.00' })
      .expect(200);
    await request(server)
      .put(`${api}/products/${trackedProductId}/units/${trackedCartonUnitId}/prices/RETAIL`)
      .set(auth(ownerATokens.accessToken))
      .send({ amount: '25.00' })
      .expect(200);

    const history = await request(server)
      .get(`${api}/products/${trackedProductId}/units/${trackedCartonUnitId}/prices`)
      .set(auth(salesTokens.accessToken))
      .expect(200);

    const body = history.body as PriceHistoryBody;
    expect(body.data[0]).toMatchObject({
      productUnitName: 'carton',
      oldAmount: '24.00',
      newAmount: '25.00',
      changedBy: { id: ownerATokens.user.id },
    });
    expect(body.data[1]).toMatchObject({ oldAmount: null, newAmount: '24.00' });
  });

  it('does not expose or modify another depot suppliers, purchases, or stock', async () => {
    const supplierB = await request(server)
      .post(`${api}/suppliers`)
      .set(auth(ownerBTokens.accessToken))
      .send({ name: `Depot B Supplier ${runId}` })
      .expect(201);
    const supplierBId = (supplierB.body as SupplierView).id;

    const productB = await request(server)
      .post(`${api}/products`)
      .set(auth(ownerBTokens.accessToken))
      .send({
        sku: 'B-STOCK-001',
        name: 'Depot B Product',
        baseUnit: 'bottle',
        units: [{ name: 'carton', conversionFactor: '24' }],
      })
      .expect(201);
    const productBView = productB.body as ProductView;

    const purchaseB = await request(server)
      .post(`${api}/purchases`)
      .set(auth(ownerBTokens.accessToken))
      .send({
        supplierId: supplierBId,
        lines: [
          {
            productId: productBView.id,
            unitId: productBView.baseUnit.id,
            quantity: '1',
            unitCost: '1.00',
          },
        ],
      })
      .expect(201);

    await request(server)
      .get(`${api}/suppliers/${supplierBId}`)
      .set(auth(ownerATokens.accessToken))
      .expect(404);
    await request(server)
      .get(`${api}/purchases/${(purchaseB.body as PurchaseView).id}`)
      .set(auth(ownerATokens.accessToken))
      .expect(404);
    await request(server)
      .post(`${api}/stock/adjustments`)
      .set(auth(ownerATokens.accessToken))
      .send({
        productId: productBView.id,
        unitId: productBView.baseUnit.id,
        quantity: '1',
        reason: 'Cross depot',
      })
      .expect(404);
    await request(server)
      .post(`${api}/purchases`)
      .set(auth(ownerATokens.accessToken))
      .send({
        supplierId: supplierBId,
        lines: [
          {
            productId: simpleProductId,
            unitId: simpleBottleUnitId,
            quantity: '1',
            unitCost: '1.00',
          },
        ],
      })
      .expect(404);
    await request(server)
      .get(`${api}/products/${productBView.id}/units/${productBView.baseUnit.id}/prices`)
      .set(auth(ownerATokens.accessToken))
      .expect(404);
  });
});
