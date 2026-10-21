import { ApiProperty } from '@nestjs/swagger';

import { CustomerType } from '../../../generated/prisma/enums.js';

export class CustomerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Sokha Restaurant' })
  name!: string;

  @ApiProperty({ nullable: true, example: '+85512345678' })
  phone!: string | null;

  @ApiProperty({ nullable: true, example: 'buyer@example.com' })
  email!: string | null;

  @ApiProperty({ nullable: true, example: 'Street 271, Phnom Penh' })
  address!: string | null;

  @ApiProperty({ enum: CustomerType, example: CustomerType.WHOLESALE })
  type!: CustomerType;

  @ApiProperty({ nullable: true, example: '500.00', description: 'Null means no limit.' })
  creditLimit!: string | null;

  @ApiProperty({ nullable: true, example: 30 })
  paymentTermDays!: number | null;

  @ApiProperty({ nullable: true, example: 'Pays at the end of the month' })
  notes!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: false, description: 'The default cash customer of the depot.' })
  isWalkIn!: boolean;

  @ApiProperty({
    example: '125.00',
    description: 'Outstanding balance derived from invoices and payments.',
  })
  balance!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class CustomerListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 4 })
  total!: number;
}

export class PaginatedCustomersDto {
  @ApiProperty({ type: [CustomerDto] })
  data!: CustomerDto[];

  @ApiProperty({ type: () => CustomerListMetaDto })
  meta!: CustomerListMetaDto;
}

export class CustomerStatementLineDto {
  @ApiProperty({ example: '2026-10-21', description: 'Date of the entry.' })
  date!: string;

  @ApiProperty({ enum: ['INVOICE', 'PAYMENT'], example: 'INVOICE' })
  type!: 'INVOICE' | 'PAYMENT';

  @ApiProperty({ example: 'INV-000123' })
  reference!: string;

  @ApiProperty({ example: 'ABC Beer 330ml' })
  description!: string;

  @ApiProperty({ example: '288.00', description: 'Invoice total or payment amount.' })
  debit!: string;

  @ApiProperty({ example: '0.00', description: 'Payment amount; zero on an invoice line.' })
  credit!: string;

  @ApiProperty({ example: '288.00', description: 'Running balance after this entry.' })
  balance!: string;
}

export class CustomerStatementDto {
  @ApiProperty({ type: () => CustomerDto })
  customer!: CustomerDto;

  @ApiProperty({ example: '125.00' })
  openingBalance!: string;

  @ApiProperty({ example: '500.00' })
  totalInvoiced!: string;

  @ApiProperty({ example: '375.00' })
  totalPaid!: string;

  @ApiProperty({ example: '125.00' })
  closingBalance!: string;

  @ApiProperty({ type: [CustomerStatementLineDto] })
  lines!: CustomerStatementLineDto[];
}
