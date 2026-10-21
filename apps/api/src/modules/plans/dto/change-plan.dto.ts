import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString } from 'class-validator';

import { trimUpperString } from '../../../common/validation/transforms.js';

export const PLAN_CODES = ['FREE_TRIAL', 'BASIC', 'PRO'] as const;

export type PlanCode = (typeof PLAN_CODES)[number];

export class ChangeDepotPlanDto {
  @ApiProperty({
    enum: PLAN_CODES,
    example: 'BASIC',
    description: 'The plan code the depot moves to.',
  })
  @Transform(trimUpperString)
  @IsString()
  @IsIn(PLAN_CODES)
  planCode!: PlanCode;
}
