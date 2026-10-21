import { ApiProperty } from '@nestjs/swagger';

import { PaymentMethod } from '../../../generated/prisma/enums.js';

export class PaymentAllocationViewDto {
  @ApiProperty({ format: 'uuid' })
  invoiceId!: string;

  @ApiProperty({ example: 'INV-000123' })
  invoiceNumber!: string;

  @ApiProperty({ example: '100.00' })
  amount!: string;
}

export class PaymentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ example: 'Sokha Restaurant' })
  customerName!: string;

  @ApiProperty({ example: '250.00' })
  amount!: string;

  @ApiProperty({ example: '100.00', description: 'Sum of the allocations.' })
  allocatedAmount!: string;

  @ApiProperty({ example: '150.00', description: 'Money that stays as customer credit.' })
  unallocatedAmount!: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  method!: PaymentMethod;

  @ApiProperty({ nullable: true, example: 'Receipt 2026-1042' })
  reference!: string | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ format: 'date-time' })
  paidAt!: Date;

  @ApiProperty({ example: 'Dara Sok' })
  receivedBy!: string | null;

  @ApiProperty({ type: [PaymentAllocationViewDto] })
  allocations!: PaymentAllocationViewDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class PaymentListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 3 })
  total!: number;
}

export class PaginatedPaymentsDto {
  @ApiProperty({ type: [PaymentDto] })
  data!: PaymentDto[];

  @ApiProperty({ type: () => PaymentListMetaDto })
  meta!: PaymentListMetaDto;
}
