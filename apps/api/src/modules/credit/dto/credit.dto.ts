import { ApiProperty } from '@nestjs/swagger';

export class AgeingBucketDto {
  @ApiProperty({ example: '0-30', description: 'Days past the due date.' })
  key!: string;

  @ApiProperty({ example: 0 })
  minDays!: number;

  @ApiProperty({ example: 30, nullable: true })
  maxDays!: number | null;

  @ApiProperty({ example: 2 })
  invoiceCount!: number;

  @ApiProperty({ example: '450.00' })
  amount!: string;
}

export class CreditOverviewDto {
  @ApiProperty({ example: '1250.00', description: 'Total outstanding balance of the depot.' })
  totalOutstanding!: string;

  @ApiProperty({ example: '430.00', description: 'Outstanding balance that is past the due date.' })
  totalOverdue!: string;

  @ApiProperty({ example: 4 })
  openInvoiceCount!: number;

  @ApiProperty({ example: 2 })
  overdueInvoiceCount!: number;

  @ApiProperty({
    example: '100.00',
    description: 'Money that was paid on voided invoices and still has to be refunded.',
  })
  totalRefundDue!: string;

  @ApiProperty({ type: [AgeingBucketDto] })
  ageing!: AgeingBucketDto[];
}

export class OverdueInvoiceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'INV-000123' })
  invoiceNumber!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ example: 'Sokha Restaurant' })
  customerName!: string;

  @ApiProperty({ example: '288.00' })
  total!: string;

  @ApiProperty({ example: '188.00' })
  outstanding!: string;

  @ApiProperty({ format: 'date-time' })
  orderDate!: Date;

  @ApiProperty({ format: 'date-time' })
  dueDate!: Date | null;

  @ApiProperty({ example: 12, description: 'Days past the due date.' })
  daysOverdue!: number;

  @ApiProperty({ example: '0-30' })
  ageingBucket!: string;
}

export class OverdueListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 2 })
  total!: number;
}

export class PaginatedOverdueDto {
  @ApiProperty({ type: [OverdueInvoiceDto] })
  data!: OverdueInvoiceDto[];

  @ApiProperty({ type: () => OverdueListMetaDto })
  meta!: OverdueListMetaDto;
}
