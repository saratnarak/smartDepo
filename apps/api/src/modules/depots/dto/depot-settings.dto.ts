import { ApiProperty } from '@nestjs/swagger';

import { CreditLimitMode, Locale } from '../../../generated/prisma/enums.js';

export class DepotSettingsDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Boeng Keng Kong Depot' })
  name!: string;

  @ApiProperty({ nullable: true, example: 'Street 271, Phnom Penh' })
  address!: string | null;

  @ApiProperty({ example: 'KHR' })
  currency!: string;

  @ApiProperty({ enum: Locale, example: Locale.EN })
  locale!: string;

  @ApiProperty({ nullable: true, example: 'Thank you for your business.' })
  invoiceFooter!: string | null;

  @ApiProperty({ nullable: true, description: 'Stored object key of the depot logo image.' })
  logoKey!: string | null;

  @ApiProperty({ enum: CreditLimitMode, example: CreditLimitMode.WARN })
  creditLimitMode!: CreditLimitMode;
}
