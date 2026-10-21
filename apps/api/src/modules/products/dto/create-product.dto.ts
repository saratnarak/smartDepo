import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { DECIMAL_3_MESSAGE, DECIMAL_3_PATTERN } from '../../../common/validation/decimal.js';
import { trimString, trimToNull, trimUpperString } from '../../../common/validation/transforms.js';
import { CreateProductUnitDto } from './create-product-unit.dto.js';

export class CreateProductDto {
  @ApiProperty({
    description: 'Unique per depot. Stored in uppercase.',
    example: 'BEER-001',
    pattern: '^[A-Z0-9][A-Z0-9._-]{0,63}$',
  })
  @Transform(trimUpperString)
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9._-]{0,63}$/, {
    message: 'sku must contain only letters, digits, dot, underscore, or dash',
  })
  sku!: string;

  @ApiProperty({ example: 'ABC Beer 330ml', minLength: 2, maxLength: 160 })
  @Transform(trimString)
  @IsString()
  @Length(2, 160)
  name!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({
    description: 'Low-stock threshold in the base unit.',
    default: '0',
    example: '120',
    pattern: '^\\d{1,15}(\\.\\d{1,3})?$',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Matches(DECIMAL_3_PATTERN, { message: DECIMAL_3_MESSAGE })
  reorderLevel?: string;

  @ApiPropertyOptional({
    description: 'Whether purchases for this product require a batch number and expiry date.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  trackBatches?: boolean;

  @ApiProperty({ description: 'Name of the base unit.', example: 'bottle', maxLength: 40 })
  @Transform(trimString)
  @IsString()
  @Length(1, 40)
  baseUnit!: string;

  @ApiPropertyOptional({
    type: [CreateProductUnitDto],
    description: 'Optional additional units such as carton or crate.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateProductUnitDto)
  units?: CreateProductUnitDto[];
}
