import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class DepotReasonDto {
  @ApiProperty({
    description: 'Reason recorded in the depot audit log for this decision.',
    example: 'Documents verified by the Platform Admin.',
    minLength: 3,
    maxLength: 500,
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 500)
  reason!: string;
}
