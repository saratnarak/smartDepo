import { ApiProperty } from '@nestjs/swagger';

export class PlatformDepotPointDto {
  @ApiProperty({ example: '2026-10' })
  period!: string;

  @ApiProperty({ example: 3 })
  registered!: number;
}

export class PlatformPlanPointDto {
  @ApiProperty({ example: 'Standard' })
  plan!: string;

  @ApiProperty({ example: 4 })
  depots!: number;
}

export class PlatformPendingDto {
  @ApiProperty({ format: 'uuid' })
  depotId!: string;

  @ApiProperty({ example: 'New Depot' })
  name!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class PlatformDashboardDto {
  @ApiProperty({ example: 12 })
  totalDepots!: number;

  @ApiProperty({ example: 8 })
  activeDepots!: number;

  @ApiProperty({ example: 3 })
  pendingApprovals!: number;

  @ApiProperty({ type: [PlatformDepotPointDto] })
  registeredOverTime!: PlatformDepotPointDto[];

  @ApiProperty({ type: [PlatformPlanPointDto] })
  depotsByPlan!: PlatformPlanPointDto[];

  @ApiProperty({ type: [PlatformPendingDto] })
  pendingDepots!: PlatformPendingDto[];
}
