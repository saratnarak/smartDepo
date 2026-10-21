import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { PriceType } from '../../../generated/prisma/enums.js';

export class PriceHistoryQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by product unit.' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ enum: PriceType })
  @IsOptional()
  @IsEnum(PriceType)
  type?: PriceType;

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
}

export class PriceHistoryUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Dara Sok' })
  name!: string;
}

export class PriceHistoryEntryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  productUnitId!: string;

  @ApiProperty({ example: 'carton' })
  productUnitName!: string;

  @ApiProperty({ enum: PriceType, example: PriceType.RETAIL })
  type!: PriceType;

  @ApiProperty({
    nullable: true,
    example: '24.00',
    description: 'Null for the first recorded price.',
  })
  oldAmount!: string | null;

  @ApiProperty({ example: '25.00' })
  newAmount!: string;

  @ApiProperty({ type: () => PriceHistoryUserDto, nullable: true })
  changedBy!: PriceHistoryUserDto | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class PriceHistoryMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 5 })
  total!: number;
}

export class PaginatedPriceHistoryDto {
  @ApiProperty({ type: [PriceHistoryEntryDto] })
  data!: PriceHistoryEntryDto[];

  @ApiProperty({ type: () => PriceHistoryMetaDto })
  meta!: PriceHistoryMetaDto;
}
