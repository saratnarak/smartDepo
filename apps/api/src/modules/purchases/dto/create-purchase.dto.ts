import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { trimToNull, trimUpperString } from '../../../common/validation/transforms.js';
import { PurchaseLineDto } from './purchase-line.dto.js';

export class CreatePurchaseDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  supplierId!: string;

  @ApiPropertyOptional({
    description: 'Generated automatically when omitted. Unique per depot.',
    example: 'PO-20261021-001',
    maxLength: 64,
  })
  @IsOptional()
  @Transform(trimUpperString)
  @Matches(/^[A-Z0-9][A-Z0-9._-]{0,63}$/, {
    message: 'referenceNumber must contain only letters, digits, dot, underscore, or dash',
  })
  referenceNumber?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @ApiProperty({ type: [PurchaseLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  lines!: PurchaseLineDto[];
}
