import { ApiProperty } from '@nestjs/swagger';

export class AuditActorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Sokha Owner' })
  name!: string;

  @ApiProperty({ example: 'OWNER' })
  role!: string;
}

export class AuditLogEntryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'STAFF_CREATED' })
  action!: string;

  @ApiProperty({ example: 'User' })
  entityType!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  entityId!: string | null;

  @ApiProperty({ type: () => AuditActorDto, nullable: true })
  actor!: AuditActorDto | null;

  @ApiProperty({ nullable: true, example: '203.0.113.10' })
  ipAddress!: string | null;

  @ApiProperty({
    nullable: true,
    type: Object,
    description: 'The values before the change. Secrets are never part of an entry.',
  })
  before!: Record<string, unknown> | null;

  @ApiProperty({
    nullable: true,
    type: Object,
    description: 'The values after the change. Secrets are never part of an entry.',
  })
  after!: Record<string, unknown> | null;

  @ApiProperty({
    nullable: true,
    type: Object,
    description: 'Extra information of the entry. Secrets are never part of an entry.',
  })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}
