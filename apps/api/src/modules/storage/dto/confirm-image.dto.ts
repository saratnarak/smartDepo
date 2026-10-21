import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class ConfirmImageDto {
  @ApiProperty({
    example: 'depots/9c7f1c52-.../logo/8b2a.../3f1c... .png',
    description: 'Object key returned by the presigned upload request.',
  })
  @IsString()
  @MaxLength(512)
  @Matches(/^depots\/[0-9a-f-]+\/(logo|products)\//, {
    message: 'key must start with depots/{depotId}/{type}/',
  })
  key!: string;
}
