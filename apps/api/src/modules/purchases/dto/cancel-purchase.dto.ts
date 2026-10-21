import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { trimToNull } from '../../../common/validation/transforms.js';

export class CancelPurchaseDto {
  @ApiPropertyOptional({ example: 'Supplier could not deliver', maxLength: 500 })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}
