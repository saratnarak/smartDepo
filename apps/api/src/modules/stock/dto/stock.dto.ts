import { ApiProperty } from '@nestjs/swagger';

import { StockMovementType } from '../../../generated/prisma/enums.js';
import { ProductCategoryDto, ProductUnitDto } from '../../products/dto/product.dto.js';

export class StockBatchDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'LOT-2026-01' })
  batchNumber!: string;

  @ApiProperty({ format: 'date', nullable: true })
  expiryDate!: Date | null;

  @ApiProperty({ example: '24' })
  currentStock!: string;

  @ApiProperty({ example: '1 carton' })
  currentStockReadable!: string;
}

export class StockProductDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'BEER-001' })
  sku!: string;

  @ApiProperty({ example: 'ABC Beer 330ml' })
  name!: string;

  @ApiProperty({ type: () => ProductCategoryDto, nullable: true })
  category!: ProductCategoryDto | null;

  @ApiProperty({ example: '120' })
  reorderLevel!: string;

  @ApiProperty({ example: '1.50', description: 'Last purchase cost per base unit.' })
  costPrice!: string;

  @ApiProperty({ example: true })
  trackBatches!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: () => ProductUnitDto })
  baseUnit!: ProductUnitDto;

  @ApiProperty({ type: [ProductUnitDto] })
  units!: ProductUnitDto[];

  @ApiProperty({ example: '293' })
  currentStock!: string;

  @ApiProperty({ example: '12 cartons and 5 bottles' })
  currentStockReadable!: string;

  @ApiProperty({ example: false })
  lowStock!: boolean;

  @ApiProperty({ type: [StockBatchDto] })
  batches!: StockBatchDto[];
}

export class StockListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 30 })
  total!: number;
}

export class PaginatedStockDto {
  @ApiProperty({ type: [StockProductDto] })
  data!: StockProductDto[];

  @ApiProperty({ type: () => StockListMetaDto })
  meta!: StockListMetaDto;
}

export class StockMovementProductDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'BEER-001' })
  sku!: string;

  @ApiProperty({ example: 'ABC Beer 330ml' })
  name!: string;
}

export class StockMovementBatchDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'LOT-2026-01' })
  batchNumber!: string;

  @ApiProperty({ format: 'date', nullable: true })
  expiryDate!: Date | null;
}

export class StockMovementUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Dara Sok' })
  name!: string;
}

export class StockMovementDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: StockMovementType, example: StockMovementType.PURCHASE })
  type!: StockMovementType;

  @ApiProperty({ example: '288' })
  quantity!: string;

  @ApiProperty({ example: '12 cartons' })
  quantityReadable!: string;

  @ApiProperty({ nullable: true, example: '1.00', description: 'Cost per base unit.' })
  unitCost!: string | null;

  @ApiProperty({ nullable: true, example: 'Purchase received' })
  reason!: string | null;

  @ApiProperty({ type: () => StockMovementProductDto })
  product!: StockMovementProductDto;

  @ApiProperty({ type: () => StockMovementBatchDto, nullable: true })
  batch!: StockMovementBatchDto | null;

  @ApiProperty({ type: () => StockMovementUserDto, nullable: true })
  createdBy!: StockMovementUserDto | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  saleOrderId!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  purchaseOrderId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class PaginatedStockMovementsDto {
  @ApiProperty({ type: [StockMovementDto] })
  data!: StockMovementDto[];

  @ApiProperty({ type: () => StockListMetaDto })
  meta!: StockListMetaDto;
}

export class BatchStockAlertDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'LOT-2026-01' })
  batchNumber!: string;

  @ApiProperty({ format: 'date' })
  expiryDate!: Date;

  @ApiProperty({ example: -3, description: 'Negative when the batch is already expired.' })
  daysToExpiry!: number;

  @ApiProperty({ example: 'ABC Beer 330ml' })
  productName!: string;

  @ApiProperty({ example: 'BEER-001' })
  productSku!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ example: '24' })
  currentStock!: string;

  @ApiProperty({ example: '1 carton' })
  currentStockReadable!: string;
}

export class BatchAlertsDto {
  @ApiProperty({ example: 30 })
  days!: number;

  @ApiProperty({ type: [BatchStockAlertDto] })
  nearExpiry!: BatchStockAlertDto[];

  @ApiProperty({ type: [BatchStockAlertDto] })
  expired!: BatchStockAlertDto[];
}

export class StockAdjustmentResultDto {
  @ApiProperty({ format: 'uuid' })
  movementId!: string;

  @ApiProperty({ enum: StockMovementType, example: StockMovementType.ADJUSTMENT })
  type!: StockMovementType;

  @ApiProperty({ example: '-5' })
  quantity!: string;

  @ApiProperty({ example: '-5 bottles' })
  quantityReadable!: string;

  @ApiProperty({ example: '15' })
  stockAfter!: string;

  @ApiProperty({ example: '15 bottles' })
  stockAfterReadable!: string;
}
