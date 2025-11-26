import { Injectable, Logger } from '@nestjs/common';
import { IntradayOhlcService } from '../../navasan/services/intraday-ohlc.service';
import { GOLD_MULTIPLIER_ITEMS } from '../constants/market-data.constants';
import { MarketDataResponse, PriceItem } from '../types/market-data.types';

/**
 * MarketDataEnrichmentService
 *
 * Responsible for enriching market data with additional information
 * - Enriches change values from OHLC data
 * - Applies gold multipliers for coin prices
 * - Adds metadata to responses
 */
@Injectable()
export class MarketDataEnrichmentService {
  private readonly logger = new Logger(MarketDataEnrichmentService.name);

  constructor(private readonly intradayOhlcService: IntradayOhlcService) {}

  /**
   * Enrich change values in the response using OHLC data
   * When API doesn't provide change values (or returns 0), calculate from OHLC data
   * Change = ((close - open) / open) * 100
   */
  async enrichChangeValues(
    data: MarketDataResponse,
  ): Promise<MarketDataResponse> {
    try {
      // Get all today's OHLC data
      const ohlcData = await this.intradayOhlcService.getAllTodayOhlc();

      if (!ohlcData || ohlcData.length === 0) {
        this.logger.debug('No OHLC data available for enriching change values');
        return data;
      }

      // Create a map for quick lookup
      const ohlcMap = new Map<string, { change: number }>();
      for (const ohlc of ohlcData) {
        ohlcMap.set(ohlc.itemCode.toLowerCase(), { change: ohlc.change });
      }

      // Enrich each item with OHLC-based change if API change is 0 or missing
      const enrichedData = { ...data };
      let enrichedCount = 0;

      for (const [key, value] of Object.entries(enrichedData)) {
        // Skip metadata keys
        if (key.startsWith('_')) continue;

        const item = value as PriceItem;
        const ohlc = ohlcMap.get(key.toLowerCase());

        // Only enrich if current change is 0 or undefined AND we have OHLC data
        if (ohlc && (item.change === 0 || item.change === undefined)) {
          item.change = ohlc.change;
          enrichedCount++;
        }
      }

      if (enrichedCount > 0) {
        this.logger.log(
          `Enriched ${enrichedCount} items with OHLC-based change values`,
        );
      }

      return enrichedData;
    } catch (error) {
      this.logger.warn(
        `Failed to enrich change values from OHLC: ${error instanceof Error ? error.message : String(error)}`,
      );
      return data; // Return original data if enrichment fails
    }
  }

  /**
   * Apply gold multipliers to coin prices
   * Gold coins (sekkeh, bahar, nim, rob, gerami) are stored in thousands
   * We multiply by 1000 to get the actual value in tomans
   *
   * Note: 18ayar and abshodeh are already in tomans, so we don't multiply them
   */
  applyGoldMultipliers(data: MarketDataResponse): MarketDataResponse {
    const transformedData = { ...data };

    for (const coin of GOLD_MULTIPLIER_ITEMS) {
      const coinData = transformedData[coin];

      if (coinData && typeof coinData === 'object') {
        const item = coinData as PriceItem;

        if (typeof item.value === 'string') {
          const numValue = Number(item.value);
          if (!isNaN(numValue)) {
            item.value = String(numValue * 1000);
          }
        }

        if (typeof item.change === 'number') {
          item.change = item.change * 1000;
        }
      }
    }

    return transformedData;
  }

  /**
   * Add standard metadata to response
   * Returns a combined object with data and metadata
   * Note: Uses Record<string, unknown> to allow mixed PriceItem and metadata types
   */
  addMetadata(
    data: MarketDataResponse,
    source: string,
    additionalMetadata?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      ...data,
      _metadata: {
        source,
        enrichedAt: new Date().toISOString(),
        ...additionalMetadata,
      },
    };
  }

  /**
   * Enrich and transform gold data
   * Applies multipliers and enriches with OHLC change values
   */
  async enrichGoldData(data: MarketDataResponse): Promise<MarketDataResponse> {
    // First apply gold multipliers
    const withMultipliers = this.applyGoldMultipliers(data);

    // Then enrich with OHLC change values
    return this.enrichChangeValues(withMultipliers);
  }

  /**
   * Calculate change percentage between two values
   */
  calculateChangePercentage(
    currentValue: number,
    previousValue: number,
  ): number {
    if (previousValue === 0) return 0;
    return ((currentValue - previousValue) / previousValue) * 100;
  }

  /**
   * Calculate absolute change between two values
   */
  calculateAbsoluteChange(currentValue: number, previousValue: number): number {
    return currentValue - previousValue;
  }

  /**
   * Format price value to string with proper formatting
   */
  formatPriceValue(value: number, decimals: number = 0): string {
    return value.toFixed(decimals);
  }

  /**
   * Validate and fix data structure
   * Ensures all required fields are present
   */
  normalizeDataStructure(data: MarketDataResponse): MarketDataResponse {
    const normalized: MarketDataResponse = {};

    for (const [key, value] of Object.entries(data)) {
      // Skip metadata keys
      if (key.startsWith('_')) {
        normalized[key] = value;
        continue;
      }

      if (value && typeof value === 'object') {
        const item = value as PriceItem;

        normalized[key] = {
          value: item.value ?? '0',
          change: item.change ?? 0,
          utc: item.utc ?? new Date().toISOString(),
          date: item.date ?? new Date().toISOString().split('T')[0],
          dt: item.dt ?? new Date().toTimeString().split(' ')[0],
        };
      }
    }

    return normalized;
  }

  /**
   * Check if data needs enrichment
   * Returns true if any item has change value of 0 or undefined
   */
  needsEnrichment(data: MarketDataResponse): boolean {
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('_')) continue;

      if (value && typeof value === 'object') {
        const item = value as PriceItem;
        if (item.change === 0 || item.change === undefined) {
          return true;
        }
      }
    }

    return false;
  }
}
