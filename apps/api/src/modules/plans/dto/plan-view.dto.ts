import { ApiProperty } from '@nestjs/swagger';

export class PlanViewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'FREE_TRIAL' })
  code!: string;

  @ApiProperty({ example: 'Free Trial' })
  name!: string;

  @ApiProperty({
    example: '0.00',
    description: 'Monthly price for display only. The billing is simulated.',
  })
  priceMonthly!: string;

  @ApiProperty({ nullable: true, example: 2, description: 'Maximum active staff accounts.' })
  maxUsers!: number | null;

  @ApiProperty({ nullable: true, example: 10, description: 'Maximum active products.' })
  maxProducts!: number | null;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class PlanUsageDto {
  @ApiProperty({ example: 3, description: 'Active staff accounts of the depot.' })
  users!: number;

  @ApiProperty({ example: 4, description: 'Active products of the depot.' })
  products!: number;
}

export class DepotPlanViewDto {
  @ApiProperty({
    type: () => PlanViewDto,
    nullable: true,
    description: 'The active plan of the depot.',
  })
  plan!: PlanViewDto | null;

  @ApiProperty({ type: () => PlanUsageDto })
  usage!: PlanUsageDto;

  @ApiProperty({
    example: { users: 2, products: 10 },
    description: 'The limits of the plan. Null means no limit.',
  })
  limits!: { users: number | null; products: number | null };

  @ApiProperty({
    example: false,
    description: 'True when the depot uses more than the plan allows.',
  })
  overLimit!: boolean;
}
