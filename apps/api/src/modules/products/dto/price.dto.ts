import { ApiProperty } from '@nestjs/swagger';

import { PriceType } from '../../../generated/prisma/enums.js';

export class PriceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productUnitId!: string;

  @ApiProperty({ enum: PriceType, example: PriceType.RETAIL })
  type!: string;

  @ApiProperty({ example: '1.50' })
  amount!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
