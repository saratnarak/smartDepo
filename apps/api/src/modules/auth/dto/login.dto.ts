import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Registered owner email address or phone number.',
    example: 'owner@example.com',
    minLength: 3,
    maxLength: 254,
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 254)
  identifier!: string;

  @ApiProperty({ example: 'Password1', minLength: 1, maxLength: 72 })
  @IsString()
  @Length(1, 72)
  password!: string;
}
