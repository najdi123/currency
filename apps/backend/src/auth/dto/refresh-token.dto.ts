import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token to obtain a new access token',
    example: '7f9c8e3a2b1d4f6e8a0c5b7d9e1f3a5c...',
  })
  @IsString()
  refreshToken!: string;
}
