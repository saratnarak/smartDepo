import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { MONEY_2_MESSAGE, MONEY_2_PATTERN } from '../../../common/validation/decimal.js';
import { trimString, trimToNull } from '../../../common/validation/transforms.js';
import { CustomerType } from '../../../generated/prisma/enums.js';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Sokha Restaurant', minLength: 2, maxLength: 160 })
  @Transform(trimString)
  @IsString()
  @Length(2, 160)
  name!: string;

  @ApiPropertyOptional({ example: '+85512345678', maxLength: 40, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @ApiPropertyOptional({ example: 'buyer@example.com', maxLength: 160, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsEmail()
  @MaxLength(160)
  email?: string | null;

  @ApiPropertyOptional({ example: 'Street 271, Phnom Penh', maxLength: 500, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional({
    enum: CustomerType,
    description: 'The price list this customer gets: retail or wholesale.',
    example: CustomerType.WHOLESALE,
  })
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @ApiPropertyOptional({
    description: 'Maximum outstanding balance. Null means no limit.',
    example: '500.00',
    nullable: true,
    pattern: '^\\d{1,12}(\\.\\d{1,2})?$',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Matches(MONEY_2_PATTERN, { message: MONEY_2_MESSAGE })
  creditLimit?: string | null;

  @ApiPropertyOptional({
    description: 'Payment terms in days. Null means the invoice is due on the day it is written.',
    example: 30,
    minimum: 0,
    maximum: 365,
    nullable: true,
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsInt()
  @Min(0)
  @Max(365)
  paymentTermDays?: number | null;

  @ApiPropertyOptional({ example: 'Pays at the end of the month', maxLength: 1000, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
