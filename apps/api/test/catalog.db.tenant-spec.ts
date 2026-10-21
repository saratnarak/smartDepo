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
import { Prisma } from '../src/generated/prisma/client.js';
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

interface CategoryView {
  id: string;
  name: string;
  isActive: boolean;
}

interface ProductPriceView {
  id: string;
  type: string;
  amount: string;
}

interface ProductUnitView {
  id: string;
  name: string;
  conversionFactor: string;
  isBaseUnit: boolean;
  isActive: boolean;
  prices: ProductPriceView[];
}

interface ProductView {
  id: string;
  sku: string;
  name: string;
  reorderLevel: string;
  trackBatches: boolean;
  isActive: boolean;
  baseUnit: ProductUnitView;
  units: ProductUnitView[];
  category: CategoryView | null;
}

interface ProductListBody {
  data: ProductView[];
  meta: { page: number; pageSize: number; total: number };
}

interface CategoryListBody {
  data: CategoryView[];
  meta: { page: number; pageSize: number; total: number };
}

describe('Catalog: categories, products, units, and prices (database)', () => {
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
  let ownerATokens: LoginResponse;
  let stockKeeperTokens: LoginResponse;
  let salesTokens: LoginResponse;
  let deliveryTokens: LoginResponse;
  let ownerBTokens: LoginResponse;
  let depotBId: string;

  let categoryId: string;
  let archivedCategoryId: string;
  let productId: string;
  let cartonUnitId: string;
  let palletUnitId: string;
  let secondProductId: string;
  let depotBProductId: string;

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
    const email = `catalog-${role.toLowerCase()}-${runId}@example.com`;
    await request(server)
      .post(`${api}/users`)
      .set(auth(ownerATokens.accessToken))
      .send({ name, email, phone: uniquePhone(role.length), role, password: staffPassword })
      .expect(201);

    return email;
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

    adminEmail = `catalog-admin-${runId}@example.com`;
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
      'Catalog Depot A',
      `catalog-a-${runId}@example.com`,
      uniquePhone(1),
    );
    depotAId = depotA.depot.id;
    await approveDepot(depotAId);
    ownerATokens = await login(`catalog-a-${runId}@example.com`, ownerPassword);

    const stockKeeperEmail = await createStaff('Catalog Stock Keeper', 'STOCK_KEEPER');
    stockKeeperTokens = await login(stockKeeperEmail, staffPassword);

    const salesEmail = await createStaff('Catalog Sales', 'SALES');
    salesTokens = await login(salesEmail, staffPassword);

    const deliveryEmail = await createStaff('Catalog Delivery', 'DELIVERY');
    deliveryTokens = await login(deliveryEmail, staffPassword);

    const depotB = await registerDepot(
      'Catalog Depot B',
      `catalog-b-${runId}@example.com`,
      uniquePhone(2),
    );
    depotBId = depotB.depot.id;
    await approveDepot(depotBId);
    ownerBTokens = await login(`catalog-b-${runId}@example.com`, ownerPassword);
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication for catalog endpoints', async () => {
    await request(server).get(`${api}/products`).expect(401);
    await request(server).get(`${api}/categories`).expect(401);
  });

  it('lets the owner create a category and the stock keeper edit it', async () => {
    const created = await request(server)
      .post(`${api}/categories`)
      .set(auth(ownerATokens.accessToken))
      .send({ name: 'Beer' })
      .expect(201);

    const category = created.body as CategoryView;
    expect(category).toMatchObject({ name: 'Beer', isActive: true });
    categoryId = category.id;

    const updated = await request(server)
      .patch(`${api}/categories/${categoryId}`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({ name: 'Beer and drinks' })
      .expect(200);

    expect(updated.body).toMatchObject({ id: categoryId, name: 'Beer and drinks' });
    expect(await auditActions(depotAId)).toEqual(
      expect.arrayContaining(['CATEGORY_CREATED', 'CATEGORY_UPDATED']),
    );
  });

  it('creates and archives a category, and lists categories with filters', async () => {
    const created = await request(server)
      .post(`${api}/categories`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({ name: 'Snacks' })
      .expect(201);

    archivedCategoryId = (created.body as CategoryView).id;

    const archived = await request(server)
      .post(`${api}/categories/${archivedCategoryId}/archive`)
      .set(auth(stockKeeperTokens.accessToken))
      .expect(200);

    expect(archived.body).toMatchObject({ id: archivedCategoryId, isActive: false });

    const list = await request(server)
      .get(`${api}/categories`)
      .set(auth(ownerATokens.accessToken))
      .query({ isActive: 'false', search: 'snack', sort: 'name', order: 'asc' })
      .expect(200);

    expect((list.body as CategoryListBody).meta).toMatchObject({ total: 1 });
    expect((list.body as CategoryListBody).data[0].id).toBe(archivedCategoryId);
  });

  it('rejects duplicate and invalid category input and hides categories from sales', async () => {
    await request(server)
      .post(`${api}/categories`)
      .set(auth(ownerATokens.accessToken))
      .send({ name: 'beer and drinks' })
      .expect(409);

    await request(server)
      .post(`${api}/categories`)
      .set(auth(ownerATokens.accessToken))
      .send({ name: 'X' })
      .expect(400);

    await request(server).get(`${api}/categories`).set(auth(salesTokens.accessToken)).expect(200);

    await request(server)
      .post(`${api}/categories`)
      .set(auth(salesTokens.accessToken))
      .send({ name: 'Sales Category' })
      .expect(403);
  });

  it('creates a product with a base unit, extra units, and a reorder level', async () => {
    const response = await request(server)
      .post(`${api}/products`)
      .set(auth(ownerATokens.accessToken))
      .send({
        sku: 'beer-001',
        name: 'ABC Beer 330ml',
        description: 'Case of 24 bottles',
        categoryId,
        reorderLevel: '120',
        trackBatches: true,
        baseUnit: 'bottle',
        units: [
          { name: 'carton', conversionFactor: '24' },
          { name: 'crate', conversionFactor: '12' },
        ],
      })
      .expect(201);

    const body = response.body as ProductView;
    expect(body).toMatchObject({
      sku: 'BEER-001',
      name: 'ABC Beer 330ml',
      reorderLevel: '120',
      trackBatches: true,
      isActive: true,
      category: { id: categoryId },
    });
    expect(body.baseUnit).toMatchObject({
      name: 'bottle',
      conversionFactor: '1',
      isBaseUnit: true,
    });
    expect(body.units).toHaveLength(3);
    expect(body.units.map((unit) => unit.name).sort()).toEqual(['bottle', 'carton', 'crate']);

    productId = body.id;
    cartonUnitId = body.units.find((unit) => unit.name === 'carton')?.id ?? '';
    expect(cartonUnitId).not.toBe('');

    expect(await auditActions(depotAId)).toContain('PRODUCT_CREATED');
  });

  it('rejects duplicate SKU, invalid units, another depot category, and a depot id in the body', async () => {
    await request(server)
      .post(`${api}/products`)
      .set(auth(ownerATokens.accessToken))
      .send({
        sku: 'BEER-001',
        name: 'Duplicate Beer',
        baseUnit: 'bottle',
      })
      .expect(409);

    await request(server)
      .post(`${api}/products`)
      .set(auth(ownerATokens.accessToken))
      .send({
        sku: 'beer-bad-factor',
        name: 'Bad Factor',
        baseUnit: 'bottle',
        units: [{ name: 'carton', conversionFactor: '1' }],
      })
      .expect(400);

    await request(server)
      .post(`${api}/products`)
      .set(auth(ownerATokens.accessToken))
      .send({
        sku: 'beer-bad-factor-2',
        name: 'Bad Factor 2',
        baseUnit: 'bottle',
        units: [{ name: 'carton', conversionFactor: '0' }],
      })
      .expect(400);

    const otherCategory = await request(server)
      .post(`${api}/categories`)
      .set(auth(ownerBTokens.accessToken))
      .send({ name: 'Other Depot Category' })
      .expect(201);

    await request(server)
      .post(`${api}/products`)
      .set(auth(ownerATokens.accessToken))
      .send({
        sku: 'beer-other-category',
        name: 'Other Category',
        categoryId: (otherCategory.body as CategoryView).id,
        baseUnit: 'bottle',
      })
      .expect(400);

    const response = await request(server)
      .post(`${api}/products`)
      .set(auth(ownerATokens.accessToken))
      .send({
        sku: 'beer-depot-field',
        name: 'Depot Field',
        baseUnit: 'bottle',
        depotId: depotBId,
      })
      .expect(400);

    expect(response.body).toMatchObject({ message: 'Validation failed' });
  });

  it('lists products with search, category, active filter, pagination, and sorting', async () => {
    const second = await request(server)
      .post(`${api}/products`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({
        sku: 'STOUT-002',
        name: 'Dark Stout 330ml',
        categoryId,
        reorderLevel: '12',
        baseUnit: 'bottle',
        units: [{ name: 'carton', conversionFactor: '24' }],
      })
      .expect(201);

    secondProductId = (second.body as ProductView).id;

    const response = await request(server)
      .get(`${api}/products`)
      .set(auth(salesTokens.accessToken))
      .query({
        search: 'beer',
        categoryId,
        isActive: 'true',
        page: 1,
        pageSize: 10,
        sort: 'name',
        order: 'asc',
      })
      .expect(200);

    const body = response.body as ProductListBody;
    expect(body.meta).toMatchObject({ page: 1, pageSize: 10, total: 1 });
    expect(body.data[0].id).toBe(productId);
    expect(body.data[0].units.find((unit) => unit.name === 'carton')?.prices).toEqual([]);
  });

  it('edits a product and rejects an archived category', async () => {
    const response = await request(server)
      .patch(`${api}/products/${productId}`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({ name: 'ABC Beer 330ml Premium', reorderLevel: '150.5' })
      .expect(200);

    expect(response.body).toMatchObject({
      id: productId,
      name: 'ABC Beer 330ml Premium',
      reorderLevel: '150.5',
    });
    expect(await auditActions(depotAId)).toContain('PRODUCT_UPDATED');

    await request(server)
      .patch(`${api}/products/${productId}`)
      .set(auth(ownerATokens.accessToken))
      .send({ categoryId: archivedCategoryId })
      .expect(400);
  });

  it('adds, edits, and archives an additional unit', async () => {
    const created = await request(server)
      .post(`${api}/products/${productId}/units`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({ name: 'pallet', conversionFactor: '240' })
      .expect(201);

    palletUnitId = (created.body as ProductUnitView).id;
    expect(created.body).toMatchObject({ name: 'pallet', conversionFactor: '240', isActive: true });

    await request(server)
      .post(`${api}/products/${productId}/units`)
      .set(auth(ownerATokens.accessToken))
      .send({ name: 'bad-unit', conversionFactor: '1' })
      .expect(400);

    await request(server)
      .post(`${api}/products/${productId}/units`)
      .set(auth(ownerATokens.accessToken))
      .send({ name: 'pallet', conversionFactor: '250' })
      .expect(409);

    const updated = await request(server)
      .patch(`${api}/products/${productId}/units/${palletUnitId}`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({ conversionFactor: '288' })
      .expect(200);

    expect(updated.body).toMatchObject({ id: palletUnitId, conversionFactor: '288' });

    await request(server)
      .post(`${api}/products/${productId}/units/${palletUnitId}/archive`)
      .set(auth(stockKeeperTokens.accessToken))
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ id: palletUnitId, isActive: false });
      });

    const baseUnitId = (
      (await request(server)
        .get(`${api}/products/${productId}`)
        .set(auth(ownerATokens.accessToken))
        .expect(200)) as { body: ProductView }
    ).body.baseUnit.id;

    await request(server)
      .post(`${api}/products/${productId}/units/${baseUnitId}/archive`)
      .set(auth(ownerATokens.accessToken))
      .expect(400);

    expect(await auditActions(depotAId)).toEqual(
      expect.arrayContaining([
        'PRODUCT_UNIT_CREATED',
        'PRODUCT_UNIT_UPDATED',
        'PRODUCT_UNIT_ARCHIVED',
      ]),
    );
  });

  it('sets retail and wholesale prices and records price history', async () => {
    const retail = await request(server)
      .put(`${api}/products/${productId}/units/${cartonUnitId}/prices/RETAIL`)
      .set(auth(ownerATokens.accessToken))
      .send({ amount: '24.00' })
      .expect(200);

    expect(retail.body).toMatchObject({ type: 'RETAIL', amount: '24.00' });

    await request(server)
      .put(`${api}/products/${productId}/units/${cartonUnitId}/prices/WHOLESALE`)
      .set(auth(ownerATokens.accessToken))
      .send({ amount: '22.50' })
      .expect(200);

    await request(server)
      .put(`${api}/products/${productId}/units/${cartonUnitId}/prices/RETAIL`)
      .set(auth(ownerATokens.accessToken))
      .send({ amount: '24.00' })
      .expect(200);

    await request(server)
      .put(`${api}/products/${productId}/units/${cartonUnitId}/prices/RETAIL`)
      .set(auth(ownerATokens.accessToken))
      .send({ amount: '25.00' })
      .expect(200);

    const history = await prisma.runAsPlatformAdmin(adminPrincipal, (transaction) =>
      transaction.priceHistory.findMany({
        where: { depotId: depotAId, productUnitId: cartonUnitId },
        orderBy: { createdAt: 'asc' },
      }),
    );

    expect(history.map((entry) => `${entry.type}:${entry.amount.toFixed(2)}`)).toEqual([
      'RETAIL:24.00',
      'WHOLESALE:22.50',
      'RETAIL:25.00',
    ]);

    const product = await request(server)
      .get(`${api}/products/${productId}`)
      .set(auth(salesTokens.accessToken))
      .expect(200);

    const carton = (product.body as ProductView).units.find((unit) => unit.id === cartonUnitId);
    expect(carton?.prices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'RETAIL', amount: '25.00' }),
        expect.objectContaining({ type: 'WHOLESALE', amount: '22.50' }),
      ]),
    );
    expect(await auditActions(depotAId)).toContain('PRICE_CHANGED');
  });

  it('forbids sales and stock keepers from changing prices and rejects invalid amounts', async () => {
    await request(server)
      .put(`${api}/products/${productId}/units/${cartonUnitId}/prices/RETAIL`)
      .set(auth(salesTokens.accessToken))
      .send({ amount: '1.00' })
      .expect(403);

    await request(server)
      .put(`${api}/products/${productId}/units/${cartonUnitId}/prices/RETAIL`)
      .set(auth(stockKeeperTokens.accessToken))
      .send({ amount: '1.00' })
      .expect(403);

    await request(server)
      .put(`${api}/products/${productId}/units/${cartonUnitId}/prices/RETAIL`)
      .set(auth(ownerATokens.accessToken))
      .send({ amount: '-1.00' })
      .expect(400);

    await request(server)
      .put(`${api}/products/${productId}/units/${cartonUnitId}/prices/RETAIL`)
      .set(auth(ownerATokens.accessToken))
      .send({ amount: '1.999' })
      .expect(400);
  });

  it('enforces database checks for negative money and duplicate base units', async () => {
    await expect(
      prisma.runAsPlatformAdmin(adminPrincipal, (transaction) =>
        transaction.productUnit.create({
          data: {
            depotId: depotAId,
            productId,
            name: 'negative-factor',
            conversionFactor: new Prisma.Decimal('-1'),
            isBaseUnit: false,
          },
        }),
      ),
    ).rejects.toThrow();

    await expect(
      prisma.runAsPlatformAdmin(adminPrincipal, (transaction) =>
        transaction.productUnit.create({
          data: {
            depotId: depotAId,
            productId,
            name: 'second-base',
            conversionFactor: new Prisma.Decimal('1'),
            isBaseUnit: true,
          },
        }),
      ),
    ).rejects.toThrow();

    await expect(
      prisma.runAsPlatformAdmin(adminPrincipal, (transaction) =>
        transaction.price.create({
          data: {
            depotId: depotAId,
            productUnitId: palletUnitId,
            type: 'RETAIL',
            amount: new Prisma.Decimal('-1'),
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('archives a product and blocks new units and prices for it', async () => {
    const archived = await request(server)
      .post(`${api}/products/${productId}/archive`)
      .set(auth(stockKeeperTokens.accessToken))
      .expect(200);

    expect(archived.body).toMatchObject({ id: productId, isActive: false });

    await request(server)
      .post(`${api}/products/${productId}/units`)
      .set(auth(ownerATokens.accessToken))
      .send({ name: 'box', conversionFactor: '6' })
      .expect(400);

    await request(server)
      .put(`${api}/products/${productId}/units/${cartonUnitId}/prices/RETAIL`)
      .set(auth(ownerATokens.accessToken))
      .send({ amount: '30.00' })
      .expect(400);

    await request(server)
      .get(`${api}/products/${productId}`)
      .set(auth(salesTokens.accessToken))
      .expect(200);

    const archivedList = await request(server)
      .get(`${api}/products`)
      .set(auth(ownerATokens.accessToken))
      .query({ isActive: 'false', search: 'beer' })
      .expect(200);

    expect((archivedList.body as ProductListBody).data.map((product) => product.id)).toContain(
      productId,
    );
  });

  it('rejects using an archived category for a new product', async () => {
    await request(server)
      .post(`${api}/products`)
      .set(auth(ownerATokens.accessToken))
      .send({
        sku: 'SNACK-001',
        name: 'Snack',
        categoryId: archivedCategoryId,
        baseUnit: 'bag',
      })
      .expect(400);
  });

  it('does not expose or modify another depot catalog', async () => {
    const categoryB = await request(server)
      .post(`${api}/categories`)
      .set(auth(ownerBTokens.accessToken))
      .send({ name: 'Depot B Category' })
      .expect(201);

    const productB = await request(server)
      .post(`${api}/products`)
      .set(auth(ownerBTokens.accessToken))
      .send({
        sku: 'B-001',
        name: 'Depot B Product',
        categoryId: (categoryB.body as CategoryView).id,
        baseUnit: 'bottle',
      })
      .expect(201);

    depotBProductId = (productB.body as ProductView).id;

    const list = await request(server)
      .get(`${api}/products`)
      .set(auth(ownerATokens.accessToken))
      .query({ search: 'Depot B Product' })
      .expect(200);

    expect((list.body as ProductListBody).data).toEqual([]);

    await request(server)
      .get(`${api}/products/${depotBProductId}`)
      .set(auth(ownerATokens.accessToken))
      .expect(404);

    await request(server)
      .patch(`${api}/products/${depotBProductId}`)
      .set(auth(ownerATokens.accessToken))
      .send({ name: 'Hijacked' })
      .expect(404);

    await request(server)
      .post(`${api}/products/${depotBProductId}/archive`)
      .set(auth(ownerATokens.accessToken))
      .expect(404);

    await request(server)
      .post(`${api}/products/${depotBProductId}/units`)
      .set(auth(ownerATokens.accessToken))
      .send({ name: 'carton', conversionFactor: '24' })
      .expect(404);

    await request(server)
      .put(
        `${api}/products/${depotBProductId}/units/${(productB.body as ProductView).baseUnit.id}/prices/RETAIL`,
      )
      .set(auth(ownerATokens.accessToken))
      .send({ amount: '1.00' })
      .expect(404);

    const categories = await request(server)
      .get(`${api}/categories`)
      .set(auth(ownerATokens.accessToken))
      .query({ search: 'Depot B Category' })
      .expect(200);

    expect((categories.body as CategoryListBody).data).toEqual([]);

    await request(server)
      .patch(`${api}/categories/${(categoryB.body as CategoryView).id}`)
      .set(auth(ownerATokens.accessToken))
      .send({ name: 'Hijacked Category' })
      .expect(404);

    await request(server)
      .post(`${api}/categories/${(categoryB.body as CategoryView).id}/archive`)
      .set(auth(ownerATokens.accessToken))
      .expect(404);
  });

  it('forbids sales from managing products and delivery from reading them', async () => {
    await request(server)
      .post(`${api}/products`)
      .set(auth(salesTokens.accessToken))
      .send({ sku: 'SALES-001', name: 'Sales Product', baseUnit: 'bottle' })
      .expect(403);

    await request(server)
      .patch(`${api}/products/${secondProductId}`)
      .set(auth(salesTokens.accessToken))
      .send({ name: 'Sales Edit' })
      .expect(403);

    await request(server).get(`${api}/products`).set(auth(deliveryTokens.accessToken)).expect(403);
  });

  it('validates list query and empty update bodies', async () => {
    await request(server)
      .get(`${api}/products`)
      .set(auth(ownerATokens.accessToken))
      .query({ page: 0 })
      .expect(400);

    await request(server)
      .get(`${api}/products`)
      .set(auth(ownerATokens.accessToken))
      .query({ sort: 'unknown' })
      .expect(400);

    await request(server)
      .get(`${api}/products`)
      .set(auth(ownerATokens.accessToken))
      .query({ categoryId: 'not-a-uuid' })
      .expect(400);

    await request(server)
      .patch(`${api}/products/${secondProductId}`)
      .set(auth(ownerATokens.accessToken))
      .send({})
      .expect(400);

    await request(server)
      .patch(`${api}/categories/${categoryId}`)
      .set(auth(ownerATokens.accessToken))
      .send({})
      .expect(400);
  });
});
