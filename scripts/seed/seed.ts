/**
 * The sample data generator for SmartDepo.
 *
 * It creates three demo depots with owners, staff, products, units, prices, categories,
 * suppliers, customers, and about three months of purchases, invoices, payments, and stock
 * adjustments. The business data is written through the real services of the API, so the demo
 * depot follows the same rules as a live depot: sequential invoice numbers, the stock ledger with
 * the right signs, the earliest unexpired batch first, and the payment allocations.
 *
 * The generator runs against the compiled API in apps/api/dist, because the dependency injection
 * of Nest needs the decorator metadata that only the TypeScript compiler writes. Run
 * `pnpm --filter api build` first (the root `pnpm seed` script does that).
 *
 * Safety rules:
 *   - The script refuses to run without the explicit `--demo` flag.
 *   - It only ever deletes depots whose name starts with the demo prefix.
 *   - The login passwords come from the environment (DEMO_OWNER_PASSWORD and
 *     DEMO_STAFF_PASSWORD). They are never hard-coded and never printed.
 *   - It refuses to run against the test database unless `--allow-test-database` is given.
 *
 * Usage:
 *   pnpm seed -- --demo [--seed 42] [--months 3] [--allow-test-database]
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createSeedContext } from '../../apps/api/dist/bootstrap/seed-context.js';
import { PasswordService } from '../../apps/api/dist/modules/auth/password.service.js';
import { CategoriesService } from '../../apps/api/dist/modules/categories/categories.service.js';
import { CustomersService } from '../../apps/api/dist/modules/customers/customers.service.js';
import { DepotSettingsService } from '../../apps/api/dist/modules/depots/depot-settings.service.js';
import { InvoicesService } from '../../apps/api/dist/modules/invoices/invoices.service.js';
import { PaymentsService } from '../../apps/api/dist/modules/payments/payments.service.js';
import { ProductPricesService } from '../../apps/api/dist/modules/products/product-prices.service.js';
import { ProductsService } from '../../apps/api/dist/modules/products/products.service.js';
import { PurchasesService } from '../../apps/api/dist/modules/purchases/purchases.service.js';
import { StockService } from '../../apps/api/dist/modules/stock/stock.service.js';
import { SuppliersService } from '../../apps/api/dist/modules/suppliers/suppliers.service.js';
import { PrismaService } from '../../apps/api/dist/prisma/prisma.service.js';
import type { Prisma } from '../../apps/api/dist/generated/prisma/client.js';
import type { AuthenticatedPrincipal } from '../../apps/api/src/common/tenant/tenant-context.js';

/** Every demo depot starts with this prefix. Only depots with this prefix are ever deleted. */
const DEMO_PREFIX = 'Demo ';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface Options {
  demo: boolean;
  seed: number;
  months: number;
  allowTestDatabase: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    demo: false,
    seed: 42,
    months: 3,
    allowTestDatabase: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--demo') {
      options.demo = true;
    } else if (argument === '--allow-test-database') {
      options.allowTestDatabase = true;
    } else if (argument === '--seed') {
      index += 1;
      options.seed = Number.parseInt(argv[index] ?? '42', 10);
    } else if (argument === '--months') {
      index += 1;
      options.months = Number.parseInt(argv[index] ?? '3', 10);
    }
  }

  return options;
}

/** A small deterministic random generator so two runs produce the same demo data. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Reads the repository .env file. Real environment variables always win. */
function loadRootEnv(): void {
  const path = resolve(process.cwd(), '.env');

  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);

    if (match === null) {
      continue;
    }

    const name = match[1];
    const value = match[2].replace(/^['"]|['"]$/g, '');

    if (process.env[name] === undefined) {
      process.env[name] = value;
    }
  }
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface DemoProduct {
  sku: string;
  name: string;
  category: string;
  baseUnit: string;
  units: Array<{ name: string; conversionFactor: string }>;
  retailPrice: string;
  wholesalePrice: string;
  cost: string;
  reorderLevel: string;
  trackBatches: boolean;
}

interface DemoDepot {
  name: string;
  slug: string;
  email: string;
  phone: string;
  ownerName: string;
  /** The subscription plan of the demo depot (FR-4). */
  planCode: 'FREE_TRIAL' | 'BASIC' | 'PRO';
  categories: string[];
  products: DemoProduct[];
  suppliers: Array<{ name: string; phone: string }>;
  customers: Array<{
    name: string;
    phone: string;
    type: 'RETAIL' | 'WHOLESALE';
    creditLimit?: string;
    paymentTermDays?: number;
  }>;
}

const DEMO_DEPOTS: DemoDepot[] = [
  {
    name: 'Demo Beer Depot',
    slug: 'demo-beer',
    email: 'demo-beer-owner@example.com',
    phone: '+85510000001',
    ownerName: 'Beer Owner',
    planCode: 'PRO',
    categories: ['Beer', 'Soft drinks'],
    products: [
      {
        sku: 'BEER-ABC',
        name: 'ABC Beer 330ml',
        category: 'Beer',
        baseUnit: 'bottle',
        units: [{ name: 'carton', conversionFactor: '24' }],
        retailPrice: '1.50',
        wholesalePrice: '1.20',
        cost: '1.00',
        reorderLevel: '240',
        trackBatches: true,
      },
      {
        sku: 'BEER-ANCHOR',
        name: 'Anchor Beer 330ml',
        category: 'Beer',
        baseUnit: 'bottle',
        units: [{ name: 'carton', conversionFactor: '24' }],
        retailPrice: '1.70',
        wholesalePrice: '1.40',
        cost: '1.15',
        reorderLevel: '240',
        trackBatches: true,
      },
      {
        sku: 'BEER-IPA',
        name: 'Mekong IPA 330ml',
        category: 'Beer',
        baseUnit: 'bottle',
        units: [{ name: 'case', conversionFactor: '12' }],
        retailPrice: '2.50',
        wholesalePrice: '2.00',
        cost: '1.70',
        reorderLevel: '120',
        trackBatches: false,
      },
      {
        sku: 'SODA-COLA',
        name: 'Cola 330ml',
        category: 'Soft drinks',
        baseUnit: 'can',
        units: [{ name: 'case', conversionFactor: '24' }],
        retailPrice: '1.00',
        wholesalePrice: '0.80',
        cost: '0.65',
        reorderLevel: '240',
        trackBatches: false,
      },
    ],
    suppliers: [
      { name: 'Phnom Penh Beverages', phone: '+85510000101' },
      { name: 'Mekong Distribution', phone: '+85510000102' },
    ],
    customers: [
      {
        name: 'Sokha Restaurant',
        phone: '+85510000201',
        type: 'WHOLESALE',
        creditLimit: '2000.00',
        paymentTermDays: 30,
      },
      {
        name: 'Battambang Hotel',
        phone: '+85510000202',
        type: 'WHOLESALE',
        creditLimit: '5000.00',
        paymentTermDays: 45,
      },
      { name: 'Chaktomuk Corner Shop', phone: '+85510000203', type: 'RETAIL' },
      { name: 'Sen Sok Mini Mart', phone: '+85510000204', type: 'RETAIL' },
      {
        name: 'Kampong Cham Eatery',
        phone: '+85510000205',
        type: 'WHOLESALE',
        creditLimit: '1200.00',
        paymentTermDays: 14,
      },
    ],
  },
  {
    name: 'Demo Energy Depot',
    slug: 'demo-energy',
    email: 'demo-energy-owner@example.com',
    phone: '+85510000002',
    ownerName: 'Energy Owner',
    planCode: 'BASIC',
    categories: ['Energy drinks', 'Water'],
    products: [
      {
        sku: 'ENERGY-KRATING',
        name: 'Krating Daeng 250ml',
        category: 'Energy drinks',
        baseUnit: 'bottle',
        units: [{ name: 'case', conversionFactor: '24' }],
        retailPrice: '1.20',
        wholesalePrice: '0.95',
        cost: '0.75',
        reorderLevel: '480',
        trackBatches: true,
      },
      {
        sku: 'ENERGY-RED',
        name: 'Red Bull 250ml',
        category: 'Energy drinks',
        baseUnit: 'can',
        units: [{ name: 'case', conversionFactor: '24' }],
        retailPrice: '2.00',
        wholesalePrice: '1.70',
        cost: '1.40',
        reorderLevel: '240',
        trackBatches: true,
      },
      {
        sku: 'WATER-ANGKOR',
        name: 'Angkor Water 500ml',
        category: 'Water',
        baseUnit: 'bottle',
        units: [{ name: 'case', conversionFactor: '24' }],
        retailPrice: '0.50',
        wholesalePrice: '0.40',
        cost: '0.28',
        reorderLevel: '480',
        trackBatches: false,
      },
    ],
    suppliers: [
      { name: 'Khmers Fresh Trade', phone: '+85510000301' },
      { name: 'Sahakith Beverages', phone: '+85510000302' },
    ],
    customers: [
      { name: 'Riverside Mart', phone: '+85510000401', type: 'RETAIL' },
      {
        name: 'Sovanna Cafe',
        phone: '+85510000402',
        type: 'WHOLESALE',
        creditLimit: '900.00',
        paymentTermDays: 30,
      },
      { name: 'Tuol Keng Market Stall', phone: '+85510000403', type: 'RETAIL' },
      {
        name: 'Battambang Gym',
        phone: '+85510000404',
        type: 'WHOLESALE',
        creditLimit: '1500.00',
        paymentTermDays: 21,
      },
    ],
  },
  {
    name: 'Demo Rice Depot',
    slug: 'demo-rice',
    email: 'demo-rice-owner@example.com',
    phone: '+85510000003',
    ownerName: 'Rice Owner',
    planCode: 'BASIC',
    categories: ['Rice', 'Grocery'],
    products: [
      {
        sku: 'RICE-HOM',
        name: 'Thai Hom Mali Rice 5kg',
        category: 'Rice',
        baseUnit: 'kg',
        units: [{ name: 'sack', conversionFactor: '50' }],
        retailPrice: '0.90',
        wholesalePrice: '0.78',
        cost: '0.62',
        reorderLevel: '500',
        trackBatches: false,
      },
      {
        sku: 'RICE-BROKEN',
        name: 'Broken Rice 5kg',
        category: 'Rice',
        baseUnit: 'kg',
        units: [{ name: 'bag', conversionFactor: '40' }],
        retailPrice: '0.70',
        wholesalePrice: '0.60',
        cost: '0.48',
        reorderLevel: '400',
        trackBatches: false,
      },
      {
        sku: 'GROC-OIL',
        name: 'Palm Oil 1l',
        category: 'Grocery',
        baseUnit: 'bottle',
        units: [{ name: 'case', conversionFactor: '12' }],
        retailPrice: '1.40',
        wholesalePrice: '1.20',
        cost: '1.05',
        reorderLevel: '120',
        trackBatches: false,
      },
    ],
    suppliers: [
      { name: 'Mekong Rice Mill', phone: '+85510000501' },
      { name: 'Asean Agri Trading', phone: '+85510000502' },
    ],
    customers: [
      {
        name: 'Prey Nokor Market',
        phone: '+85510000601',
        type: 'WHOLESALE',
        creditLimit: '3000.00',
        paymentTermDays: 30,
      },
      {
        name: 'Kampong Speu Rice Shop',
        phone: '+85510000602',
        type: 'WHOLESALE',
        creditLimit: '1500.00',
        paymentTermDays: 21,
      },
      { name: 'Chroy Changvar Noodle House', phone: '+85510000603', type: 'RETAIL' },
      { name: 'Takeo Family Store', phone: '+85510000604', type: 'RETAIL' },
    ],
  },
];

interface SeededProduct {
  id: string;
  sku: string;
  name: string;
  baseUnitId: string;
  cartonUnitId: string | null;
  cartonFactor: number;
  trackBatches: boolean;
  cost: string;
  retailPrice: string;
  wholesalePrice: string;
}

interface SeedDependencies {
  prisma: PrismaService;
  platformPrincipal: AuthenticatedPrincipal;
  passwords: PasswordService;
  categories: CategoriesService;
  customers: CustomersService;
  settings: DepotSettingsService;
  invoices: InvoicesService;
  payments: PaymentsService;
  prices: ProductPricesService;
  products: ProductsService;
  purchases: PurchasesService;
  stock: StockService;
  suppliers: SuppliersService;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!options.demo) {
    console.error(
      'The sample data generator refuses to run without the --demo flag.\n' +
        'Usage: pnpm seed -- --demo [--seed 42] [--months 3] [--allow-test-database]',
    );
    process.exitCode = 1;
    return;
  }

  loadRootEnv();

  const databaseUrl = process.env.DATABASE_URL ?? '';

  if (databaseUrl === '') {
    console.error('DATABASE_URL is missing. The generator did not write anything.');
    process.exitCode = 1;
    return;
  }

  if (databaseUrl.includes('smartdepo_test') && !options.allowTestDatabase) {
    console.error(
      'The generator refuses to run against smartdepo_test. Add --allow-test-database if that is what you want.',
    );
    process.exitCode = 1;
    return;
  }

  const ownerPassword = process.env.DEMO_OWNER_PASSWORD ?? '';
  const staffPassword = process.env.DEMO_STAFF_PASSWORD ?? '';

  if (ownerPassword.trim() === '' || staffPassword.trim() === '') {
    console.error(
      'DEMO_OWNER_PASSWORD and DEMO_STAFF_PASSWORD must be set in the environment. The generator never hard-codes and never prints a password.',
    );
    process.exitCode = 1;
    return;
  }

  const random = createRandom(options.seed);
  const context = await createSeedContext();

  try {
    const deps: SeedDependencies = {
      prisma: context.get(PrismaService),
      platformPrincipal: { userId: randomUUID(), role: 'PLATFORM_ADMIN', depotId: null },
      passwords: context.get(PasswordService),
      categories: context.get(CategoriesService),
      customers: context.get(CustomersService),
      settings: context.get(DepotSettingsService),
      invoices: context.get(InvoicesService),
      payments: context.get(PaymentsService),
      prices: context.get(ProductPricesService),
      products: context.get(ProductsService),
      purchases: context.get(PurchasesService),
      stock: context.get(StockService),
      suppliers: context.get(SuppliersService),
    };

    // Only the demo depots are touched, and only the ones with the demo prefix.
    const existing = await deps.prisma.runAsPlatformAdmin(deps.platformPrincipal, (transaction) =>
      transaction.depot.findMany({
        where: { name: { startsWith: DEMO_PREFIX } },
        select: { id: true, name: true },
      }),
    );
    const knownNames = new Set(DEMO_DEPOTS.map((demo) => demo.name));

    for (const depot of existing) {
      if (!knownNames.has(depot.name)) {
        console.log(`Clearing the data of the old demo depot "${depot.name}".`);
        await removeDemoDepot(deps.prisma, deps.platformPrincipal, depot.id);
      }
    }

    const ownerHash = await deps.passwords.hash(ownerPassword);
    const staffHash = await deps.passwords.hash(staffPassword);

    for (const demo of DEMO_DEPOTS) {
      console.log(`Creating the demo depot "${demo.name}".`);
      await seedDepot({
        ...deps,
        demo,
        ownerHash,
        staffHash,
        random,
        months: options.months,
      });
    }

    console.log('The demo data is ready. Every demo depot name starts with "Demo".');
  } finally {
    await context.close();
  }
}

/**
 * Creates a user of the demo depot, or updates the one that is already there. The email of a user
 * is unique in the whole platform, so the demo users of the three depots use their own addresses.
 */
async function upsertUser(
  transaction: Prisma.TransactionClient,
  data: {
    depotId: string;
    roleId: string;
    name: string;
    email: string;
    phone: string;
    passwordHash: string;
  },
): Promise<{ id: string }> {
  const existing = await transaction.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });

  if (existing !== null) {
    await transaction.user.update({
      where: { id: existing.id },
      data: {
        depotId: data.depotId,
        roleId: data.roleId,
        name: data.name,
        phone: data.phone,
        passwordHash: data.passwordHash,
        isActive: true,
        mustChangePassword: false,
      },
    });

    return existing;
  }

  return transaction.user.create({ data, select: { id: true } });
}

/**
 * Removes the business data of a demo depot. The depot row, its users, its subscription, and the
 * audit log stay: the audit log is append-only, so it cannot be deleted, and the depot row cannot
 * be deleted while the audit log points at it. The generator reuses the depot and writes the demo
 * data again.
 */
async function removeDemoDepot(
  prisma: PrismaService,
  principal: AuthenticatedPrincipal,
  depotId: string,
): Promise<void> {
  await prisma.runAsPlatformAdmin(principal, async (transaction) => {
    await transaction.paymentAllocation.deleteMany({ where: { depotId } });
    await transaction.payment.deleteMany({ where: { depotId } });
    await transaction.saleItemBatch.deleteMany({ where: { depotId } });
    await transaction.saleItem.deleteMany({ where: { depotId } });
    await transaction.stockMovement.deleteMany({ where: { depotId } });
    await transaction.salesOrder.deleteMany({ where: { depotId } });
    await transaction.purchaseItem.deleteMany({ where: { depotId } });
    await transaction.purchaseOrder.deleteMany({ where: { depotId } });
    await transaction.batch.deleteMany({ where: { depotId } });
    await transaction.priceHistory.deleteMany({ where: { depotId } });
    await transaction.price.deleteMany({ where: { depotId } });
    await transaction.productUnit.deleteMany({ where: { depotId } });
    await transaction.product.deleteMany({ where: { depotId } });
    await transaction.category.deleteMany({ where: { depotId } });
    await transaction.customer.deleteMany({ where: { depotId } });
    await transaction.supplier.deleteMany({ where: { depotId } });
  });
}

async function seedDepot(
  deps: SeedDependencies & {
    demo: DemoDepot;
    ownerHash: string;
    staffHash: string;
    random: () => number;
    months: number;
  },
): Promise<void> {
  const { demo, random, months } = deps;
  const existing = await deps.prisma.runAsPlatformAdmin(deps.platformPrincipal, (transaction) =>
    transaction.depot.findFirst({ where: { name: demo.name }, select: { id: true } }),
  );
  const depotId = existing?.id ?? randomUUID();

  if (existing !== null) {
    console.log(`Reusing the demo depot "${demo.name}" and clearing its data.`);
    await removeDemoDepot(deps.prisma, deps.platformPrincipal, depotId);
  }

  const ownerId = await deps.prisma.runAsPlatformAdmin(
    deps.platformPrincipal,
    async (transaction) => {
      const ownerRole = await transaction.role.findUnique({ where: { code: 'OWNER' } });
      const salesRole = await transaction.role.findUnique({ where: { code: 'SALES' } });
      const keeperRole = await transaction.role.findUnique({ where: { code: 'STOCK_KEEPER' } });
      const plan = await transaction.plan.findFirst({
        where: { code: demo.planCode, isActive: true },
      });

      if (ownerRole === null || salesRole === null || keeperRole === null) {
        throw new Error('The roles are missing. Run the migrations first.');
      }

      if (plan === null) {
        throw new Error(`The plan ${demo.planCode} is missing. Run the migrations first.`);
      }

      if (existing === null) {
        await transaction.depot.create({
          data: {
            id: depotId,
            name: demo.name,
            slug: `${demo.slug}-${randomUUID().slice(0, 8)}`,
            phone: demo.phone,
            email: demo.email,
            status: 'APPROVED',
            approvedAt: new Date(),
            currency: 'KHR',
            locale: 'EN',
          },
        });
      }

      const owner = await upsertUser(transaction, {
        depotId,
        roleId: ownerRole.id,
        name: demo.ownerName,
        email: demo.email,
        phone: demo.phone,
        passwordHash: deps.ownerHash,
      });

      await upsertUser(transaction, {
        depotId,
        roleId: salesRole.id,
        name: 'Demo Sales',
        email: `sales@${demo.email}`,
        phone: `${demo.phone}1`,
        passwordHash: deps.staffHash,
      });

      await upsertUser(transaction, {
        depotId,
        roleId: keeperRole.id,
        name: 'Demo Stock Keeper',
        email: `keeper@${demo.email}`,
        phone: `${demo.phone}2`,
        passwordHash: deps.staffHash,
      });

      const subscription = await transaction.subscription.findFirst({
        where: { depotId, status: 'ACTIVE' },
        select: { id: true, plan: { select: { code: true } } },
      });

      if (subscription === null) {
        await transaction.subscription.create({
          data: { depotId, planId: plan.id, status: 'ACTIVE' },
        });
      } else if (subscription.plan.code !== demo.planCode) {
        await transaction.subscription.update({
          where: { id: subscription.id },
          data: { status: 'CANCELLED', endsAt: new Date() },
        });
        await transaction.subscription.create({
          data: { depotId, planId: plan.id, status: 'ACTIVE' },
        });
      }

      const walkIn = await transaction.customer.findFirst({
        where: { depotId, isWalkIn: true },
        select: { id: true },
      });

      if (walkIn === null) {
        await transaction.customer.create({
          data: {
            depotId,
            name: 'Walk-in',
            type: 'RETAIL',
            isActive: true,
            isWalkIn: true,
            notes: 'Default cash customer',
          },
        });
      }

      return owner.id;
    },
  );

  const owner: AuthenticatedPrincipal = { userId: ownerId, role: 'OWNER', depotId };

  await deps.settings.update(owner, { creditLimitMode: 'WARN' });

  const categoryIds = new Map<string, string>();

  for (const name of demo.categories) {
    const category = await deps.categories.create(owner, { name });
    categoryIds.set(name, category.id);
  }

  const supplierIds: string[] = [];

  for (const supplier of demo.suppliers) {
    const created = await deps.suppliers.create(owner, {
      name: supplier.name,
      phone: supplier.phone,
    });
    supplierIds.push(created.id);
  }

  const customerIds: string[] = [];

  for (const customer of demo.customers) {
    const created = await deps.customers.create(owner, {
      name: customer.name,
      phone: customer.phone,
      type: customer.type,
      creditLimit: customer.creditLimit ?? null,
      paymentTermDays: customer.paymentTermDays ?? null,
    });
    customerIds.push(created.id);
  }

  const seededProducts: SeededProduct[] = [];

  for (const product of demo.products) {
    const created = await deps.products.create(owner, {
      sku: product.sku,
      name: product.name,
      categoryId: categoryIds.get(product.category) ?? null,
      reorderLevel: product.reorderLevel,
      trackBatches: product.trackBatches,
      baseUnit: product.baseUnit,
      units: product.units,
    });
    const baseUnit = created.units.find((unit) => unit.isBaseUnit) ?? created.baseUnit;
    const carton = created.units.find((unit) => !unit.isBaseUnit);

    await deps.prices.setPrice(owner, created.id, baseUnit.id, 'RETAIL', {
      amount: product.retailPrice,
    });
    await deps.prices.setPrice(owner, created.id, baseUnit.id, 'WHOLESALE', {
      amount: product.wholesalePrice,
    });

    if (carton !== undefined) {
      const factor = Number(carton.conversionFactor);

      await deps.prices.setPrice(owner, created.id, carton.id, 'RETAIL', {
        amount: (Number(product.retailPrice) * factor).toFixed(2),
      });
      await deps.prices.setPrice(owner, created.id, carton.id, 'WHOLESALE', {
        amount: (Number(product.wholesalePrice) * factor).toFixed(2),
      });
    }

    seededProducts.push({
      id: created.id,
      sku: product.sku,
      name: product.name,
      baseUnitId: baseUnit.id,
      cartonUnitId: carton?.id ?? null,
      cartonFactor: carton === undefined ? 1 : Number(carton.conversionFactor),
      trackBatches: product.trackBatches,
      cost: product.cost,
      retailPrice: product.retailPrice,
      wholesalePrice: product.wholesalePrice,
    });
  }

  const today = new Date();
  const periodDays = months * 30;
  const start = new Date(today.getTime() - periodDays * DAY_IN_MS);

  // The first delivery fills the depot before the first sale.
  await receiveDelivery(deps, owner, seededProducts, supplierIds, random, start, 400, false);

  // A delivery every three days keeps the stock above the sales of the next days.
  for (let day = 3; day < periodDays; day += 3) {
    const date = new Date(start.getTime() + day * DAY_IN_MS);
    const expiresSoon = date.getTime() > today.getTime() - 10 * DAY_IN_MS;

    await receiveDelivery(deps, owner, seededProducts, supplierIds, random, date, 120, expiresSoon);
  }

  // Sales over the whole period: one or two invoices a day with one or two lines.
  let invoiceNumber = 0;

  for (let day = 1; day < periodDays; day += 1) {
    const date = new Date(start.getTime() + day * DAY_IN_MS);
    const invoiceCount = 1 + (random() > 0.55 ? 1 : 0);

    for (let index = 0; index < invoiceCount; index += 1) {
      const product = seededProducts[Math.floor(random() * seededProducts.length)];
      const customerIndex = Math.floor(random() * customerIds.length);
      const customerId = customerIds[customerIndex];
      const customer = demo.customers[customerIndex];
      const useCarton = product.cartonUnitId !== null && random() > 0.7;
      const quantity = useCarton ? 1 : 4 + Math.floor(random() * 12);
      const state = random();

      const unitPrice = useCarton
        ? (
            Number(customer.type === 'WHOLESALE' ? product.wholesalePrice : product.retailPrice) *
            product.cartonFactor
          ).toFixed(2)
        : customer.type === 'WHOLESALE'
          ? product.wholesalePrice
          : product.retailPrice;
      const total = (Number(quantity) * Number(unitPrice)).toFixed(2);

      const payment =
        state < 0.5
          ? { amount: total, method: 'CASH' as const }
          : state < 0.7
            ? { amount: (Number(total) / 2).toFixed(2), method: 'CASH' as const }
            : null;

      const invoice = await deps.invoices.create(owner, {
        customerId,
        lines: [
          {
            productId: product.id,
            unitId: useCarton ? (product.cartonUnitId as string) : product.baseUnitId,
            quantity: String(quantity),
          },
        ],
        payment,
      });

      invoiceNumber += 1;

      await backdateInvoice(deps, invoice.id, date, customer.paymentTermDays ?? 0);

      // Some invoices on credit get a part payment a few days later.
      if (payment === null && customer.type === 'WHOLESALE' && random() > 0.5) {
        await deps.payments.record(owner, {
          customerId,
          amount: (Number(total) / 3).toFixed(2),
          method: 'BANK_TRANSFER',
          reference: `DEMO-${invoiceNumber}`,
          paidAt: new Date(date.getTime() + 2 * DAY_IN_MS).toISOString(),
        });
      }

      // One invoice of the demo period is voided, so the reports have something to exclude.
      if (invoiceNumber === 5) {
        await deps.invoices.void(owner, invoice.id, {
          reason: 'Demo invoice that was entered by mistake',
        });
      }
    }
  }

  // Corrections, so the ledger also holds adjustments and damage.
  const keeper: AuthenticatedPrincipal = { ...owner, role: 'STOCK_KEEPER' };

  for (let index = 0; index < 3; index += 1) {
    const product = seededProducts[index % seededProducts.length];

    await deps.stock.adjust(keeper, {
      productId: product.id,
      unitId: product.baseUnitId,
      quantity: (1 + Math.floor(random() * 3)).toString(),
      reason: 'Demo stock count correction',
      batchId: await findBatchId(deps, depotId, product.id),
    });
  }

  await deps.stock.damage(keeper, {
    productId: seededProducts[0].id,
    unitId: seededProducts[0].baseUnitId,
    quantity: '2',
    reason: 'Demo breakage in the depot',
    batchId: await findBatchId(deps, depotId, seededProducts[0].id),
  });
}

/** The batch of a product that tracks batches, so the movement can point at one. */ async function findBatchId(
  deps: SeedDependencies,
  depotId: string,
  productId: string,
): Promise<string | null> {
  return deps.prisma.runAsPlatformAdmin(deps.platformPrincipal, async (transaction) => {
    const batch = await transaction.batch.findFirst({
      where: { depotId, productId },
      orderBy: { expiryDate: 'asc' },
      select: { id: true },
    });

    return batch?.id ?? null;
  });
}

/** Buys one line per product and receives the delivery. */
async function receiveDelivery(
  deps: SeedDependencies,
  owner: AuthenticatedPrincipal,
  products: SeededProduct[],
  supplierIds: string[],
  random: () => number,
  date: Date,
  baseQuantity: number,
  expiresSoon: boolean,
): Promise<void> {
  const purchase = await deps.purchases.create(owner, {
    supplierId: supplierIds[Math.floor(random() * supplierIds.length)],
    notes: 'Demo delivery',
    lines: products.map((product) => ({
      productId: product.id,
      unitId: product.baseUnitId,
      quantity: String(baseQuantity + Math.floor(random() * 40)),
      unitCost: product.cost,
      batchNumber: product.trackBatches ? `DEMO-${product.sku}-${isoDay(date)}` : null,
      expiryDate: product.trackBatches
        ? isoDay(
            new Date(
              date.getTime() + (expiresSoon ? 3 + Math.floor(random() * 22) : 180) * DAY_IN_MS,
            ),
          )
        : null,
    })),
  });

  await deps.purchases.receive(owner, purchase.id);
  await backdatePurchase(deps, purchase.id, date);
}

/**
 * Puts the invoice on the day it was sold. The services always use the current time, so the
 * generator moves the invoice, the payment, and the stock movements of the sale to the day of the
 * demo period. The invoice number, the totals, the allocations, and the ledger stay the same.
 */
async function backdateInvoice(
  deps: SeedDependencies,
  invoiceId: string,
  date: Date,
  paymentTermDays: number,
): Promise<void> {
  await deps.prisma.runAsPlatformAdmin(deps.platformPrincipal, async (transaction) => {
    const invoice = await transaction.salesOrder.findUnique({
      where: { id: invoiceId },
      select: { id: true, paymentAllocations: { select: { paymentId: true } } },
    });

    if (invoice === null) {
      return;
    }

    await transaction.salesOrder.update({
      where: { id: invoiceId },
      data: {
        orderDate: date,
        dueDate: new Date(date.getTime() + paymentTermDays * DAY_IN_MS),
      },
    });

    await transaction.stockMovement.updateMany({
      where: { saleOrderId: invoiceId },
      data: { createdAt: date },
    });

    for (const allocation of invoice.paymentAllocations) {
      const payment = await transaction.payment.findUnique({
        where: { id: allocation.paymentId },
        select: { paidAt: true },
      });

      if (payment !== null && payment.paidAt.getTime() > date.getTime()) {
        await transaction.payment.update({
          where: { id: allocation.paymentId },
          data: { paidAt: date },
        });
      }
    }
  });
}

/** Puts the purchase and its stock movements on the day of the delivery. */
async function backdatePurchase(
  deps: SeedDependencies,
  purchaseId: string,
  date: Date,
): Promise<void> {
  await deps.prisma.runAsPlatformAdmin(deps.platformPrincipal, async (transaction) => {
    await transaction.purchaseOrder.update({
      where: { id: purchaseId },
      data: { orderedAt: date, receivedAt: date },
    });

    await transaction.stockMovement.updateMany({
      where: { purchaseOrderId: purchaseId },
      data: { createdAt: date },
    });
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
