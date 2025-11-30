import {
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsIn,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Valid override duration options in minutes
 * - 1: 1 minute (for testing)
 * - 15: 15 minutes
 * - 30: 30 minutes (half hour)
 * - 60: 1 hour (DEFAULT)
 * - 120: 2 hours
 * - 300: 5 hours
 * - 720: 12 hours
 * - 1440: 24 hours
 */
export const OVERRIDE_DURATION_OPTIONS = [1, 15, 30, 60, 120, 300, 720, 1440] as const;
export type OverrideDurationOption = typeof OVERRIDE_DURATION_OPTIONS[number];

/**
 * Default override duration in minutes (1 hour)
 */
export const DEFAULT_OVERRIDE_DURATION = 60;

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

  @ApiPropertyOptional({
    description: 'Override duration in minutes. Valid values: 1, 15, 30, 60, 120, 300, 720, 1440. Defaults to 60 (1 hour).',
    example: 60,
    enum: OVERRIDE_DURATION_OPTIONS,
  })
  @IsOptional()
  @IsNumber()
  @IsIn(OVERRIDE_DURATION_OPTIONS, {
    message: `Duration must be one of: ${OVERRIDE_DURATION_OPTIONS.join(', ')} minutes`,
  })
  duration?: OverrideDurationOption;

  @ApiPropertyOptional({
    description: 'If true, the override will never expire (ignores duration). Defaults to false.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isIndefinite?: boolean;
}
