import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_PATTERN_MESSAGE,
} from '../../../common/validation/password.js';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'The password the caller is currently signed in with.',
    example: 'CurrentPassword1',
  })
  @IsString()
  @Length(1, 72)
  currentPassword!: string;

  @ApiProperty({
    description: 'New password. It must differ from the current password.',
    example: 'NewPassword2',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_PATTERN_MESSAGE })
  newPassword!: string;
}
