import { ApiProperty } from '@nestjs/swagger';

import { PurchaseOrderStatus } from '../../../generated/prisma/enums.js';

export class PurchaseLineViewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ example: 'BEER-001' })
  productSku!: string;

  @ApiProperty({ example: 'ABC Beer 330ml' })
  productName!: string;

  @ApiProperty({ format: 'uuid' })
  productUnitId!: string;

  @ApiProperty({ example: 'carton' })
  productUnitName!: string;

  @ApiProperty({ example: '12' })
  quantity!: string;

  @ApiProperty({ example: '288' })
  quantityBase!: string;

  @ApiProperty({ example: '24.00', description: 'Cost for one entered unit.' })
  unitCost!: string;

  @ApiProperty({ example: '1.00', description: 'Cost for one base unit.' })
  unitCostPerBaseUnit!: string;

  @ApiProperty({ example: '288.00' })
  lineTotal!: string;

  @ApiProperty({ nullable: true, example: 'LOT-2026-01' })
  batchNumber!: string | null;

  @ApiProperty({ format: 'date', nullable: true })
  expiryDate!: Date | null;
}

export class PurchaseSupplierDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Phnom Penh Beverages' })
  name!: string;

  @ApiProperty({ nullable: true, example: '+85512345678' })
  phone!: string | null;

  @ApiProperty({ nullable: true, example: 'supplier@example.com' })
  email!: string | null;

  @ApiProperty({ nullable: true, example: 'Street 271, Phnom Penh' })
  address!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class PurchaseUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Dara Sok' })
  name!: string;
}

export class PurchaseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'PO-20261021-ABC12345' })
  referenceNumber!: string;

  @ApiProperty({ enum: PurchaseOrderStatus, example: PurchaseOrderStatus.DRAFT })
  status!: PurchaseOrderStatus;

  @ApiProperty({ type: () => PurchaseSupplierDto })
  supplier!: PurchaseSupplierDto;

  @ApiProperty({ example: '288.00' })
  subtotal!: string;

  @ApiProperty({ example: '0.00' })
  discountTotal!: string;

  @ApiProperty({ example: '288.00' })
  total!: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  orderedAt!: Date | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  receivedAt!: Date | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ type: () => PurchaseUserDto })
  createdBy!: PurchaseUserDto;

  @ApiProperty({ type: [PurchaseLineViewDto] })
  items!: PurchaseLineViewDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class PurchaseListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 3 })
  total!: number;
}

export class PaginatedPurchasesDto {
  @ApiProperty({ type: [PurchaseDto] })
  data!: PurchaseDto[];

  @ApiProperty({ type: () => PurchaseListMetaDto })
  meta!: PurchaseListMetaDto;
}
