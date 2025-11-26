import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for overriding an item's price
 */
export class OverridePriceDto {
  @ApiProperty({
    description: 'Override price value',
    example: 112190,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({
    description: 'Override change value (price difference from previous)',
    example: -830,
  })
  @IsOptional()
  @IsNumber()
  change?: number;

  @ApiPropertyOptional({
    description: 'Reason for the override (for audit trail)',
    example: 'Correcting data entry error from API provider',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
