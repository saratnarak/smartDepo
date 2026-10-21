import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class BatchAlertsQueryDto {
  @ApiPropertyOptional({
    description: 'Number of days ahead that counts as near expiry.',
    default: 30,
    minimum: 0,
    maximum: 365,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  days = 30;
}
