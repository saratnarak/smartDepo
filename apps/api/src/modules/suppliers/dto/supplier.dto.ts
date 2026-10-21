import { ApiProperty } from '@nestjs/swagger';

export class SupplierDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Phnom Penh Beverages' })
  name!: string;

  @ApiProperty({ nullable: true, example: 'Sopheak Chan' })
  contactName!: string | null;

  @ApiProperty({ nullable: true, example: '+85512345678' })
  phone!: string | null;

  @ApiProperty({ nullable: true, example: 'supplier@example.com' })
  email!: string | null;

  @ApiProperty({ nullable: true, example: 'Street 271, Phnom Penh' })
  address!: string | null;

  @ApiProperty({ nullable: true, example: 'Delivers every Monday' })
  notes!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class SupplierListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 3 })
  total!: number;
}

export class PaginatedSuppliersDto {
  @ApiProperty({ type: [SupplierDto] })
  data!: SupplierDto[];

  @ApiProperty({ type: () => SupplierListMetaDto })
  meta!: SupplierListMetaDto;
}
