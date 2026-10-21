import { ApiProperty } from '@nestjs/swagger';

import {
  DiscountType,
  PaymentMethod,
  PaymentStatus,
  SalesOrderStatus,
} from '../../../generated/prisma/enums.js';

export class InvoiceBatchViewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'LOT-2026-01' })
  batchNumber!: string;

  @ApiProperty({ format: 'date', nullable: true })
  expiryDate!: Date | null;

  @ApiProperty({ example: '288' })
  quantity!: string;
}

export class InvoiceLineViewDto {
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

  @ApiProperty({ example: '288', description: 'Quantity in the base unit.' })
  quantityBase!: string;

  @ApiProperty({ example: '288', description: 'The same quantity in readable units.' })
  quantityReadable!: string;

  @ApiProperty({ example: '24.00' })
  unitPrice!: string;

  @ApiProperty({ example: '0.00' })
  discountAmount!: string;

  @ApiProperty({ enum: DiscountType, nullable: true })
  discountType!: DiscountType | null;

  @ApiProperty({ nullable: true, example: '10' })
  discountValue!: string | null;

  @ApiProperty({ example: '288.00' })
  lineTotal!: string;

  @ApiProperty({
    nullable: true,
    example: '1.0000',
    description: 'The cost per base unit at the moment of the sale.',
  })
  costPerBaseUnit!: string | null;

  @ApiProperty({ type: [InvoiceBatchViewDto] })
  batches!: InvoiceBatchViewDto[];
}

export class InvoicePaymentViewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '100.00' })
  amount!: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  method!: PaymentMethod;

  @ApiProperty({ format: 'date-time' })
  paidAt!: Date;

  @ApiProperty({ nullable: true, example: 'Receipt 2026-1042' })
  reference!: string | null;
}

export class InvoiceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'INV-000123' })
  invoiceNumber!: string;

  @ApiProperty({ enum: SalesOrderStatus, example: SalesOrderStatus.COMPLETED })
  status!: SalesOrderStatus;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PARTIAL })
  paymentStatus!: PaymentStatus;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ example: 'Sokha Restaurant' })
  customerName!: string;

  @ApiProperty({ example: '288.00' })
  subtotal!: string;

  @ApiProperty({ example: '0.00' })
  discountTotal!: string;

  @ApiProperty({ enum: DiscountType, nullable: true })
  discountType!: DiscountType | null;

  @ApiProperty({ nullable: true, example: '10' })
  discountValue!: string | null;

  @ApiProperty({ example: '288.00' })
  total!: string;

  @ApiProperty({ example: '188.00', description: 'Total minus the allocated payments.' })
  outstanding!: string;

  @ApiProperty({ example: '100.00', description: 'Sum of the allocated payments.' })
  paidAmount!: string;

  @ApiProperty({
    example: '0.00',
    description: 'Money that was paid on a voided invoice and still has to be refunded.',
  })
  refundDue!: string;

  @ApiProperty({ format: 'date-time' })
  orderDate!: Date;

  @ApiProperty({ format: 'date-time', nullable: true })
  dueDate!: Date | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ nullable: true, example: 'Supplier delivered the wrong beer' })
  voidReason!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  voidedAt!: Date | null;

  @ApiProperty({ example: 'Dara Sok' })
  createdBy!: string;

  @ApiProperty({ type: [InvoiceLineViewDto] })
  items!: InvoiceLineViewDto[];

  @ApiProperty({ type: [InvoicePaymentViewDto] })
  payments!: InvoicePaymentViewDto[];

  @ApiProperty({
    nullable: true,
    description: 'Set when the invoice pushed the customer past their credit limit.',
  })
  creditLimitWarning!: string | null;
}

export class InvoiceListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 3 })
  total!: number;
}

export class PaginatedInvoicesDto {
  @ApiProperty({ type: [InvoiceDto] })
  data!: InvoiceDto[];

  @ApiProperty({ type: () => InvoiceListMetaDto })
  meta!: InvoiceListMetaDto;
}

export class InvoiceDocumentCustomerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Sokha Restaurant' })
  name!: string;

  @ApiProperty({ nullable: true, example: '+85512345678' })
  phone!: string | null;

  @ApiProperty({ nullable: true, example: 'Street 271, Phnom Penh' })
  address!: string | null;
}

export class InvoiceDocumentDepotDto {
  @ApiProperty({ example: 'Boeng Keng Kong Depot' })
  name!: string;

  @ApiProperty({ nullable: true, example: 'Street 271, Phnom Penh' })
  address!: string | null;

  @ApiProperty({ nullable: true, example: '+85512345678' })
  phone!: string | null;

  @ApiProperty({ example: 'KHR' })
  currency!: string;

  @ApiProperty({ nullable: true, description: 'Stored object key of the depot logo image.' })
  logoKey!: string | null;

  @ApiProperty({ nullable: true, example: 'Thank you for your business.' })
  invoiceFooter!: string | null;
}

export class InvoiceDocumentDto {
  @ApiProperty({ example: 'INV-000123' })
  invoiceNumber!: string;

  @ApiProperty({ format: 'date-time' })
  orderDate!: Date;

  @ApiProperty({ format: 'date-time', nullable: true })
  dueDate!: Date | null;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PARTIAL })
  paymentStatus!: PaymentStatus;

  @ApiProperty({ type: () => InvoiceDocumentDepotDto })
  depot!: InvoiceDocumentDepotDto;

  @ApiProperty({ type: () => InvoiceDocumentCustomerDto })
  customer!: InvoiceDocumentCustomerDto;

  @ApiProperty({ type: [InvoiceLineViewDto] })
  items!: InvoiceLineViewDto[];

  @ApiProperty({ example: '288.00' })
  subtotal!: string;

  @ApiProperty({ example: '0.00' })
  discountTotal!: string;

  @ApiProperty({ example: '288.00' })
  total!: string;

  @ApiProperty({ example: '188.00' })
  outstanding!: string;

  @ApiProperty({ type: [InvoicePaymentViewDto] })
  payments!: InvoicePaymentViewDto[];

  @ApiProperty({ nullable: true })
  notes!: string | null;
}
