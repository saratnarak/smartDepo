import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

import { trimString } from '../../../common/validation/transforms.js';

export class VoidInvoiceDto {
  @ApiProperty({
    description: 'Why the invoice is voided. It is stored with the audit entry.',
    example: 'Supplier delivered the wrong beer',
    minLength: 3,
    maxLength: 500,
  })
  @Transform(trimString)
  @IsString()
  @Length(3, 500)
  reason!: string;
}
