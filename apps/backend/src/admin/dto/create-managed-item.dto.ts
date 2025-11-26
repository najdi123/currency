import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ItemCategory, ItemSource, ItemVariant } from '../../schemas/managed-item.schema';

/**
 * DTO for creating a new managed item
 */
export class CreateManagedItemDto {
  @ApiProperty({
    description: 'Lowercase code for API responses (e.g., "usd_sell")',
    example: 'usd_sell',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'Code must contain only lowercase letters, numbers, and underscores',
  })
  code!: string;

  @ApiPropertyOptional({
    description: 'UPPERCASE code for ohlc_permanent queries. Defaults to uppercase of code.',
    example: 'USD_SELL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ohlcCode?: string;

  @ApiPropertyOptional({
    description: 'Parent code for grouping variants (e.g., "usd" for usd_sell, usd_buy)',
    example: 'usd',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentCode?: string;

  @ApiProperty({
    description: 'Display name in English',
    example: 'US Dollar (Sell)',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    description: 'Display name in Arabic',
    example: 'دلار آمریکا (فروش)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameAr?: string;

  @ApiPropertyOptional({
    description: 'Display name in Farsi/Persian',
    example: 'دلار آمریکا (فروش)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameFa?: string;

  @ApiPropertyOptional({
    description: 'Variant type (sell or buy)',
    enum: ItemVariant,
    example: 'sell',
  })
  @IsOptional()
  @IsEnum(ItemVariant)
  variant?: ItemVariant;

  @ApiProperty({
    description: 'Item category',
    enum: ItemCategory,
    example: 'currency',
  })
  @IsEnum(ItemCategory)
  category!: ItemCategory;

  @ApiPropertyOptional({
    description: 'Icon identifier for React Icons',
    example: 'FaDollarSign',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({
    description: 'Display order within category (lower = higher priority)',
    example: 1,
    minimum: 0,
    maximum: 9999,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999)
  displayOrder?: number;

  @ApiPropertyOptional({
    description: 'Whether this item is visible to users',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Source of price data',
    enum: ItemSource,
    example: 'api',
  })
  @IsOptional()
  @IsEnum(ItemSource)
  source?: ItemSource;

  @ApiPropertyOptional({
    description: 'Whether this item has data from external API',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  hasApiData?: boolean;

  @ApiPropertyOptional({
    description: 'Initial price for manual items (source=manual)',
    example: 112190,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  overridePrice?: number;
}
