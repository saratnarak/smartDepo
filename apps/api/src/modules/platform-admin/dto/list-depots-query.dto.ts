import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { DepotStatus } from '../../../generated/prisma/enums.js';

export class ListDepotsQueryDto {
  @ApiPropertyOptional({ enum: DepotStatus, description: 'Filter depots by review status.' })
  @IsOptional()
  @IsEnum(DepotStatus)
  status?: DepotStatus;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional({
    enum: ['createdAt', 'name', 'status'],
    default: 'createdAt',
    description: 'Field used to sort the depot list.',
  })
  @IsOptional()
  @IsIn(['createdAt', 'name', 'status'])
  sort: 'createdAt' | 'name' | 'status' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
