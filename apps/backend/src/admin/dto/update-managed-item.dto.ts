import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ItemCategory, ItemSource, ItemVariant } from '../../schemas/managed-item.schema';

/**
 * DTO for updating a managed item (partial update)
 */
export class UpdateManagedItemDto {
  @ApiPropertyOptional({
    description: 'Parent code for grouping variants',
    example: 'usd',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentCode?: string;

  @ApiPropertyOptional({
    description: 'Display name in English',
    example: 'US Dollar (Sell)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

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
  })
  @IsOptional()
  @IsEnum(ItemVariant)
  variant?: ItemVariant;

  @ApiPropertyOptional({
    description: 'Item category',
    enum: ItemCategory,
  })
  @IsOptional()
  @IsEnum(ItemCategory)
  category?: ItemCategory;

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
  })
  @IsOptional()
  @IsEnum(ItemSource)
  source?: ItemSource;

  @ApiPropertyOptional({
    description: 'Whether this item has data from external API',
  })
  @IsOptional()
  @IsBoolean()
  hasApiData?: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { customField: 'value' },
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
