import { ApiProperty } from '@nestjs/swagger';

export class PresignedUploadResponseDto {
  @ApiProperty({ description: 'PUT URL the client uploads the image to.' })
  url!: string;

  @ApiProperty({ description: 'Object key, returned to the confirm endpoint after upload.' })
  key!: string;

  @ApiProperty({ example: 'image/png' })
  contentType!: string;

  @ApiProperty({ example: 'PUT' })
  method!: string;

  @ApiProperty({ example: 300 })
  expiresIn!: number;
}

export class PresignedReadResponseDto {
  @ApiProperty({ description: 'GET URL that serves the stored image.' })
  url!: string;

  @ApiProperty({ description: 'Object key of the stored image.' })
  key!: string;

  @ApiProperty({ example: 300 })
  expiresIn!: number;
}

export class ConfirmImageResponseDto {
  @ApiProperty({ description: 'Object key that was validated and saved.' })
  key!: string;
}
