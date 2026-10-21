import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import {
  DECIMAL_3_MESSAGE,
  DECIMAL_3_PATTERN,
  MONEY_2_MESSAGE,
  MONEY_2_PATTERN,
} from '../../../common/validation/decimal.js';
import { trimString, trimToNull } from '../../../common/validation/transforms.js';
import { DiscountType, PaymentMethod } from '../../../generated/prisma/enums.js';

export class InvoiceDiscountDto {
  @ApiProperty({ enum: DiscountType, example: DiscountType.PERCENT })
  @IsEnum(DiscountType)
  type!: DiscountType;

  @ApiProperty({
    description: 'A fixed amount, or a percentage when the type is PERCENT.',
    example: '10',
  })
  @Transform(trimString)
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,4})?$/, {
    message: 'discount value must be a positive number with up to 4 decimals',
  })
  value!: string;
}

export class InvoiceLineDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId!: string;

  @ApiProperty({ example: '12', pattern: '^\\d{1,15}(\\.\\d{1,3})?$' })
  @Transform(trimString)
  @IsString()
  @Matches(DECIMAL_3_PATTERN, { message: DECIMAL_3_MESSAGE })
  quantity!: string;

  @ApiPropertyOptional({
    description:
      'Overrides the price of the product unit. Only the depot owner may override a price.',
    example: '23.50',
    nullable: true,
    pattern: '^\\d{1,12}(\\.\\d{1,2})?$',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Matches(MONEY_2_PATTERN, { message: MONEY_2_MESSAGE })
  unitPrice?: string | null;

  @ApiPropertyOptional({ type: () => InvoiceDiscountDto, nullable: true })
  @IsOptional()
  @Type(() => InvoiceDiscountDto)
  @ValidateNested()
  discount?: InvoiceDiscountDto | null;
}

export class CheckoutPaymentDto {
  @ApiProperty({ example: '100.00', pattern: '^\\d{1,12}(\\.\\d{1,2})?$' })
  @Transform(trimString)
  @IsString()
  @Matches(MONEY_2_PATTERN, { message: MONEY_2_MESSAGE })
  amount!: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional({ example: 'Receipt 2026-1042', maxLength: 120, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(120)
  reference?: string | null;
}

export class CreateInvoiceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ type: [InvoiceLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];

  @ApiPropertyOptional({ type: () => InvoiceDiscountDto, nullable: true })
  @IsOptional()
  @Type(() => InvoiceDiscountDto)
  @ValidateNested()
  discount?: InvoiceDiscountDto | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @ApiPropertyOptional({
    type: () => CheckoutPaymentDto,
    nullable: true,
    description: 'Money received at the checkout. It is allocated to this invoice.',
  })
  @IsOptional()
  @Type(() => CheckoutPaymentDto)
  @ValidateNested()
  payment?: CheckoutPaymentDto | null;

  @ApiPropertyOptional({
    description:
      'Key that makes a retried create return the same invoice instead of writing a second one.',
    maxLength: 100,
    nullable: true,
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string | null;
}
