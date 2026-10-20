import { ApiProperty } from '@nestjs/swagger';

import { DepotStatus } from '../../../generated/prisma/enums.js';

export class DepotAdminViewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Boeng Keng Kong Depot' })
  name!: string;

  @ApiProperty({ example: 'boeng-keng-kong-depot-1a2b3c4d' })
  slug!: string;

  @ApiProperty({ example: '012345678' })
  phone!: string;

  @ApiProperty({ format: 'email', example: 'owner@example.com' })
  email!: string;

  @ApiProperty({ enum: DepotStatus, example: DepotStatus.PENDING })
  status!: string;

  @ApiProperty({ nullable: true, example: null })
  rejectionReason!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, example: null })
  approvedAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class DepotListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 42 })
  total!: number;
}

export class PaginatedDepotsDto {
  @ApiProperty({ type: [DepotAdminViewDto] })
  data!: DepotAdminViewDto[];

  @ApiProperty({ type: () => DepotListMetaDto })
  meta!: DepotListMetaDto;
}
