import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ItemCategory, ItemSource, ItemVariant } from '../../schemas/managed-item.schema';

/**
 * Response DTO for managed item with current price
 */
export class ManagedItemResponseDto {
  @ApiProperty({ description: 'Lowercase code for API responses', example: 'usd_sell' })
  code!: string;

  @ApiProperty({ description: 'UPPERCASE code for OHLC queries', example: 'USD_SELL' })
  ohlcCode!: string;

  @ApiPropertyOptional({ description: 'Parent code for grouping', example: 'usd' })
  parentCode?: string;

  @ApiProperty({ description: 'Display name', example: 'US Dollar (Sell)' })
  name!: string;

  @ApiPropertyOptional({ description: 'Arabic name', example: 'دلار آمریکا (فروش)' })
  nameAr?: string;

  @ApiPropertyOptional({ description: 'Farsi name', example: 'دلار آمریکا (فروش)' })
  nameFa?: string;

  @ApiPropertyOptional({ description: 'Variant type', enum: ItemVariant })
  variant?: ItemVariant;

  @ApiProperty({ description: 'Item category', enum: ItemCategory })
  category!: ItemCategory;

  @ApiPropertyOptional({ description: 'Icon identifier' })
  icon?: string;

  @ApiProperty({ description: 'Display order', example: 1 })
  displayOrder!: number;

  @ApiProperty({ description: 'Is active', example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Data source', enum: ItemSource })
  source!: ItemSource;

  @ApiProperty({ description: 'Has API data', example: true })
  hasApiData!: boolean;

  // Price data (from ohlc_permanent or override)
  @ApiPropertyOptional({ description: 'Current price', example: 112190 })
  currentPrice?: number;

  @ApiPropertyOptional({ description: 'Price change', example: -830 })
  currentChange?: number;

  @ApiPropertyOptional({ description: 'Price timestamp' })
  priceTimestamp?: Date;

  // Override information
  @ApiProperty({ description: 'Whether price is overridden', example: false })
  isOverridden!: boolean;

  @ApiPropertyOptional({ description: 'Override price (if overridden)' })
  overridePrice?: number;

  @ApiPropertyOptional({ description: 'Override change (if overridden)' })
  overrideChange?: number;

  @ApiPropertyOptional({ description: 'Override reason' })
  overrideReason?: string;

  @ApiPropertyOptional({ description: 'Override timestamp' })
  overrideAt?: Date;

  @ApiPropertyOptional({ description: 'Admin who set override' })
  overrideBy?: string;

  // Timestamps
  @ApiPropertyOptional({ description: 'Last API update' })
  lastApiUpdate?: Date;

  @ApiProperty({ description: 'Created at' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt!: Date;
}

/**
 * Response for item list with pagination
 */
export class ManagedItemListResponseDto {
  @ApiProperty({ description: 'List of items', type: [ManagedItemResponseDto] })
  items!: ManagedItemResponseDto[];

  @ApiProperty({ description: 'Total count', example: 42 })
  total!: number;

  @ApiProperty({ description: 'Current page', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Items per page', example: 50 })
  limit!: number;
}

/**
 * Response for diagnostic data
 */
export class DiagnosticDataResponseDto {
  @ApiProperty({ description: 'Item code' })
  itemCode!: string;

  @ApiProperty({ description: 'Managed item configuration' })
  managedItem?: ManagedItemResponseDto;

  @ApiProperty({ description: 'Latest OHLC data from ohlc_permanent' })
  ohlcData?: {
    timeframe: string;
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    source: string;
  };

  @ApiProperty({ description: 'Data sources summary' })
  sources!: {
    hasManagedItem: boolean;
    hasOhlcData: boolean;
    isOverridden: boolean;
    effectivePrice: number | null;
    effectiveSource: 'override' | 'ohlc' | 'none';
  };
}
