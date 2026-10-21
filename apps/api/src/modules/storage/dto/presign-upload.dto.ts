import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import { ALLOWED_CONTENT_TYPES } from '../image-validation.js';

export class PresignUploadDto {
  @ApiProperty({
    enum: ALLOWED_CONTENT_TYPES,
    example: 'image/png',
    description: 'MIME type of the image to upload. Only JPEG, PNG, and WebP are allowed.',
  })
  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType!: string;
}
