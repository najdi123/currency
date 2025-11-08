import { IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UserIdParamDto {
  @ApiProperty({
    description: 'MongoDB ObjectId of the user',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  userId!: string;
}
