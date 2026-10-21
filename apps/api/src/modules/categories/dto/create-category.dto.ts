import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

import { trimString } from '../../../common/validation/transforms.js';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Beer', minLength: 2, maxLength: 120 })
  @Transform(trimString)
  @IsString()
  @Length(2, 120)
  name!: string;
}
