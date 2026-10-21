import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { trimString, trimToNull } from '../../../common/validation/transforms.js';

export class UpdateSupplierDto {
  @ApiPropertyOptional({ example: 'Phnom Penh Beverages', minLength: 2, maxLength: 160 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(2, 160)
  name?: string;

  @ApiPropertyOptional({ example: 'Sopheak Chan', maxLength: 160, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(160)
  contactName?: string | null;

  @ApiPropertyOptional({ example: '+85512345678', maxLength: 40, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @ApiPropertyOptional({ example: 'supplier@example.com', maxLength: 160, nullable: true })
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

  @ApiPropertyOptional({ example: 'Delivers every Monday', maxLength: 1000, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
