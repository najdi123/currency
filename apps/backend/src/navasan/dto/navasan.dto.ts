import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  Matches,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { VALIDATION, ItemCategory } from '../constants/navasan.constants';

/**
 * DTO for historical data query parameters
 */
export class HistoricalDataQueryDto {
  @ApiPropertyOptional({
    description: 'Number of days of historical data to fetch',
    minimum: VALIDATION.MIN_DAYS_HISTORY,
    maximum: VALIDATION.MAX_DAYS_HISTORY,
    default: 30,
    example: 30,
  })
  @IsOptional()
  @IsInt({ message: 'Days must be an integer' })
  @Min(VALIDATION.MIN_DAYS_HISTORY, {
    message: `Days must be at least ${VALIDATION.MIN_DAYS_HISTORY}`,
  })
  @Max(VALIDATION.MAX_DAYS_HISTORY, {
    message: `Days cannot exceed ${VALIDATION.MAX_DAYS_HISTORY}`,
  })
  @Type(() => Number)
  days?: number = 30;
}

/**
 * DTO for date-specific data requests
 */
export class DateQueryDto {
  @ApiProperty({
    description: 'Date in ISO format (YYYY-MM-DD)',
    example: '2025-01-22',
  })
  @IsDateString(
    {},
    { message: 'Date must be in ISO format (YYYY-MM-DD)' },
  )
  date: string;
}

/**
 * DTO for category parameter validation
 */
export class CategoryParamDto {
  @ApiProperty({
    description: 'Item category (currencies, crypto, gold)',
    enum: ['currencies', 'crypto', 'gold'],
    example: 'currencies',
  })
  @IsString()
  @IsEnum(['currencies', 'crypto', 'gold'], {
    message: 'Category must be one of: currencies, crypto, gold',
  })
  category: ItemCategory;
}

/**
 * DTO for code parameter validation
 */
export class CodeParamDto {
  @ApiProperty({
    description: 'Item code (e.g., usd_sell, btc, gold_mesghal)',
    example: 'usd_sell',
  })
  @IsString()
  @Matches(VALIDATION.SAFE_CATEGORY_PATTERN, {
    message: 'Code must contain only alphanumeric characters, hyphens, and underscores',
  })
  code: string;
}

/**
 * DTO for OHLC query parameters
 */
export class OhlcQueryDto {
  @ApiPropertyOptional({
    description: 'Timeframe for OHLC data (1m, 5m, 15m, 1h, 4h, 1d)',
    enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
    default: '1h',
    example: '1h',
  })
  @IsOptional()
  @IsString()
  @IsEnum(['1m', '5m', '15m', '1h', '4h', '1d'], {
    message: 'Timeframe must be one of: 1m, 5m, 15m, 1h, 4h, 1d',
  })
  timeframe?: string = '1h';

  @ApiPropertyOptional({
    description: 'Number of data points to return',
    minimum: 1,
    maximum: 1000,
    default: 100,
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  limit?: number = 100;
}

/**
 * DTO for snapshot query parameters
 */
export class SnapshotQueryDto {
  @ApiPropertyOptional({
    description: 'Start date for snapshot range (ISO format)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for snapshot range (ISO format)',
    example: '2025-01-22',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
