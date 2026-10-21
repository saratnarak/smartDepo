import { ApiProperty } from '@nestjs/swagger';

import { PriceType } from '../../../generated/prisma/enums.js';

export class ProductPriceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: PriceType, example: PriceType.RETAIL })
  type!: string;

  @ApiProperty({ example: '1.50' })
  amount!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class ProductUnitDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'carton' })
  name!: string;

  @ApiProperty({ example: '24', description: 'Number of base units in this unit.' })
  conversionFactor!: string;

  @ApiProperty({ example: false })
  isBaseUnit!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: [ProductPriceDto] })
  prices!: ProductPriceDto[];
}

export class ProductCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Beer' })
  name!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class ProductDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'BEER-001' })
  sku!: string;

  @ApiProperty({ example: 'ABC Beer 330ml' })
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ type: () => ProductCategoryDto, nullable: true })
  category!: ProductCategoryDto | null;

  @ApiProperty({ example: '120', description: 'Reorder level in the base unit.' })
  reorderLevel!: string;

  @ApiProperty({ example: '1.50', description: 'Last purchase cost per base unit.' })
  costPrice!: string;

  @ApiProperty({ example: false })
  trackBatches!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: () => ProductUnitDto })
  baseUnit!: ProductUnitDto;

  @ApiProperty({ type: [ProductUnitDto] })
  units!: ProductUnitDto[];

  @ApiProperty({ example: '293', description: 'Current stock in the base unit.' })
  currentStock!: string;

  @ApiProperty({ example: '12 cartons and 5 bottles' })
  currentStockReadable!: string;

  @ApiProperty({
    example: false,
    description: 'True when current stock is at or below reorder level.',
  })
  lowStock!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class ProductListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 10000 })
  total!: number;
}

export class PaginatedProductsDto {
  @ApiProperty({ type: [ProductDto] })
  data!: ProductDto[];

  @ApiProperty({ type: () => ProductListMetaDto })
  meta!: ProductListMetaDto;
}
