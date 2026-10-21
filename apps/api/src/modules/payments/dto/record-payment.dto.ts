import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { MONEY_2_MESSAGE, MONEY_2_PATTERN } from '../../../common/validation/decimal.js';
import { trimString, trimToNull } from '../../../common/validation/transforms.js';
import { PaymentMethod } from '../../../generated/prisma/enums.js';

export class PaymentAllocationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  invoiceId!: string;

  @ApiProperty({ example: '100.00', pattern: '^\\d{1,12}(\\.\\d{1,2})?$' })
  @Transform(trimString)
  @IsString()
  @Matches(MONEY_2_PATTERN, { message: MONEY_2_MESSAGE })
  amount!: string;
}

export class RecordPaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ example: '250.00', pattern: '^\\d{1,12}(\\.\\d{1,2})?$' })
  @Transform(trimString)
  @IsString()
  @Matches(MONEY_2_PATTERN, { message: MONEY_2_MESSAGE })
  amount!: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional({ format: 'date-time', description: 'Defaults to now.' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional({ example: 'Receipt 2026-1042', maxLength: 120, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(120)
  reference?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @ApiPropertyOptional({
    type: [PaymentAllocationDto],
    description:
      'Where the money goes. Without allocations the oldest open invoices are paid first. Money that is not allocated stays as customer credit.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationDto)
  allocations?: PaymentAllocationDto[];
}
