import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

import { trimString, trimToNull } from '../../../common/validation/transforms.js';
import { CreditLimitMode, Locale } from '../../../generated/prisma/enums.js';

const toCurrencyCode = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class UpdateDepotSettingsDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120, example: 'Boeng Keng Kong Depot' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional({
    description: 'Set to null or an empty string to clear the address.',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional({
    description: 'ISO 4217 currency code, three uppercase letters.',
    example: 'KHR',
    pattern: '^[A-Z]{3}$',
  })
  @IsOptional()
  @Transform(toCurrencyCode)
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a three-letter ISO 4217 code' })
  currency?: string;

  @ApiPropertyOptional({
    enum: Locale,
    description: 'Default language for the depot.',
    example: Locale.EN,
  })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;

  @ApiPropertyOptional({
    description: 'Text printed at the bottom of invoices. Set to null or an empty string to clear.',
    maxLength: 1000,
    nullable: true,
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(1000)
  invoiceFooter?: string | null;

  @ApiPropertyOptional({
    enum: CreditLimitMode,
    description:
      'What happens when an invoice would push a customer past their credit limit: warn the user, or block the invoice.',
    example: CreditLimitMode.WARN,
  })
  @IsOptional()
  @IsEnum(CreditLimitMode)
  creditLimitMode?: CreditLimitMode;
}
