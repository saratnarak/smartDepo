import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_PATTERN_MESSAGE,
} from '../../../common/validation/password.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDepotDto {
  @ApiProperty({
    description: 'Depot display name. The server also generates a unique slug.',
    example: 'Boeng Keng Kong Depot',
    minLength: 2,
    maxLength: 120,
  })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  depotName!: string;

  @ApiProperty({
    description: 'Name of the OWNER account created with the depot.',
    example: 'Sokha Owner',
    minLength: 2,
    maxLength: 120,
  })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  ownerName!: string;

  @ApiProperty({
    description: 'Unique owner phone number. Digits, spaces, parentheses, +, and - are accepted.',
    example: '012345678',
    minLength: 7,
    maxLength: 20,
  })
  @Transform(trim)
  @IsString()
  @Matches(/^\+?[0-9() -]{7,20}$/, { message: 'phone must be a valid phone number' })
  phone!: string;

  @ApiProperty({
    description: 'Unique owner email address. It is stored in lowercase.',
    format: 'email',
    example: 'owner@example.com',
    maxLength: 254,
  })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    description: 'At least 8 characters with one letter and one number.',
    example: 'Password1',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_PATTERN, {
    message: PASSWORD_PATTERN_MESSAGE,
  })
  password!: string;
}
