import { IsString, MinLength, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ChangePasswordDto {
  @ApiProperty({
    description: "Current password for verification",
    example: "OldPass123!",
    minLength: 6,
  })
  @IsString()
  @MinLength(6) // Current password uses old validation (6 chars min)
  currentPassword!: string;

  @ApiProperty({
    description:
      "New password (min 8 chars, must contain uppercase, lowercase, digit, and special character)",
    example: "NewPass123!",
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: "New password must be at least 8 characters long" })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      "New password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character (@$!%*?&)",
  })
  newPassword!: string;
}
