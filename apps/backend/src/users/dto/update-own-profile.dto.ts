import { IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateOwnProfileDto {
  @ApiPropertyOptional({
    description: "User first name",
    example: "John",
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    description: "User last name",
    example: "Doe",
  })
  @IsOptional()
  @IsString()
  lastName?: string;
}
