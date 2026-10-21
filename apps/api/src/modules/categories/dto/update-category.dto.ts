import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';

import { trimString } from '../../../common/validation/transforms.js';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Beer and drinks', minLength: 2, maxLength: 120 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(2, 120)
  name?: string;
}
