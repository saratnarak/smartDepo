import { ApiProperty } from '@nestjs/swagger';

export class CategoryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Beer' })
  name!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class CategoryListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 4 })
  total!: number;
}

export class PaginatedCategoriesDto {
  @ApiProperty({ type: [CategoryDto] })
  data!: CategoryDto[];

  @ApiProperty({ type: () => CategoryListMetaDto })
  meta!: CategoryListMetaDto;
}
