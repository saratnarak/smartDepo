import { formatBaseQuantity } from '../../common/units/quantity.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { PriceType } from '../../generated/prisma/enums.js';

const productUnitOrderBy: Prisma.ProductUnitOrderByWithRelationInput[] = [
  { isBaseUnit: 'desc' },
  { name: 'asc' },
];

export const productSelect = {
  id: true,
  sku: true,
  name: true,
  description: true,
  reorderLevel: true,
  costPrice: true,
  trackBatches: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: { id: true, name: true, isActive: true },
  },
  productUnits: {
    orderBy: productUnitOrderBy,
    select: {
      id: true,
      name: true,
      conversionFactor: true,
      isBaseUnit: true,
      isActive: true,
      prices: {
        orderBy: { type: 'asc' },
        select: { id: true, type: true, amount: true, updatedAt: true },
      },
    },
  },
} as const;

export type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

export interface ProductPriceView {
  id: string;
  type: PriceType;
  amount: string;
  updatedAt: Date;
}

export interface ProductUnitView {
  id: string;
  name: string;
  conversionFactor: string;
  isBaseUnit: boolean;
  isActive: boolean;
  prices: ProductPriceView[];
}

export interface ProductView {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: { id: string; name: string; isActive: boolean } | null;
  reorderLevel: string;
  costPrice: string;
  trackBatches: boolean;
  isActive: boolean;
  baseUnit: ProductUnitView;
  units: ProductUnitView[];
  currentStock: string;
  currentStockReadable: string;
  lowStock: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toProductView(
  product: ProductRow,
  currentStock: Prisma.Decimal = new Prisma.Decimal(0),
): ProductView {
  const units: ProductUnitView[] = product.productUnits.map((unit) => ({
    id: unit.id,
    name: unit.name,
    conversionFactor: unit.conversionFactor.toString(),
    isBaseUnit: unit.isBaseUnit,
    isActive: unit.isActive,
    prices: unit.prices.map((price) => ({
      id: price.id,
      type: price.type,
      amount: price.amount.toFixed(2),
      updatedAt: price.updatedAt,
    })),
  }));

  const baseUnit = units.find((unit) => unit.isBaseUnit);

  if (baseUnit === undefined) {
    throw new Error('Product has no base unit');
  }

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    category: product.category,
    reorderLevel: product.reorderLevel.toString(),
    costPrice: product.costPrice.toFixed(2),
    trackBatches: product.trackBatches,
    isActive: product.isActive,
    baseUnit,
    units,
    currentStock: currentStock.toString(),
    currentStockReadable: formatBaseQuantity(currentStock, units),
    lowStock: currentStock.lte(product.reorderLevel),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
