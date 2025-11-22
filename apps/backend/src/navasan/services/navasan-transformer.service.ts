import { Injectable, Logger } from '@nestjs/common';
import { ItemCategory } from '../constants/navasan.constants';

/**
 * NavasanTransformerService
 *
 * Responsible for data transformation and formatting
 * - Transforms API responses to internal format
 * - Calculates change percentages and deltas
 * - Handles timezone conversions
 * - Implements type guards
 * - Formats data for different clients
 */
@Injectable()
export class NavasanTransformerService {
  private readonly logger = new Logger(NavasanTransformerService.name);

  /**
   * Transform raw API response to standardized format
   */
  transformApiResponse(rawData: any, category: ItemCategory): any {
    if (!rawData || typeof rawData !== 'object') {
      this.logger.warn(`Invalid data structure for ${category}`);
      return null;
    }

    // Add metadata to response
    return {
      ...rawData,
      metadata: {
        category,
        transformedAt: new Date().toISOString(),
        source: 'api',
      },
    };
  }

  /**
   * Calculate change percentage between current and previous values
   */
  calculateChange(current: string | number, previous: string | number): string | null {
    try {
      const currentNum = typeof current === 'string' ? parseFloat(current) : current;
      const previousNum = typeof previous === 'string' ? parseFloat(previous) : previous;

      if (isNaN(currentNum) || isNaN(previousNum) || previousNum === 0) {
        return null;
      }

      const change = ((currentNum - previousNum) / previousNum) * 100;
      return change.toFixed(2);
    } catch (error) {
      this.logger.error('Error calculating change percentage', error);
      return null;
    }
  }

  /**
   * Calculate absolute delta between values
   */
  calculateDelta(current: string | number, previous: string | number): string | null {
    try {
      const currentNum = typeof current === 'string' ? parseFloat(current) : current;
      const previousNum = typeof previous === 'string' ? parseFloat(previous) : previous;

      if (isNaN(currentNum) || isNaN(previousNum)) {
        return null;
      }

      const delta = currentNum - previousNum;
      return delta.toFixed(2);
    } catch (error) {
      this.logger.error('Error calculating delta', error);
      return null;
    }
  }

  /**
   * Transform OHLC data to API response format
   */
  transformOhlcData(ohlcData: any): any {
    if (!ohlcData) {
      return null;
    }

    return {
      open: this.formatNumber(ohlcData.open),
      high: this.formatNumber(ohlcData.high),
      low: this.formatNumber(ohlcData.low),
      close: this.formatNumber(ohlcData.close),
      timestamp: ohlcData.timestamp,
    };
  }

  /**
   * Transform historical data to API response format
   */
  transformHistoricalData(historicalData: any[], category: ItemCategory): any {
    if (!Array.isArray(historicalData) || historicalData.length === 0) {
      return {
        data: [],
        metadata: {
          category,
          count: 0,
          isEmpty: true,
        },
      };
    }

    const transformed = historicalData.map((item) => ({
      ...item,
      timestamp: item.timestamp || item.date,
    }));

    return {
      data: transformed,
      metadata: {
        category,
        count: transformed.length,
        startDate: transformed[0]?.timestamp,
        endDate: transformed[transformed.length - 1]?.timestamp,
      },
    };
  }

  /**
   * Add metadata to response
   */
  addMetadata(data: any, options: {
    isFresh?: boolean;
    isStale?: boolean;
    source?: string;
    category?: ItemCategory;
    isHistorical?: boolean;
    historicalDate?: Date;
  }): any {
    return {
      data,
      metadata: {
        isFresh: options.isFresh ?? false,
        isStale: options.isStale ?? false,
        source: options.source || 'unknown',
        category: options.category,
        lastUpdated: new Date().toISOString(),
        cached: options.isFresh || options.isStale || false,
        isHistorical: options.isHistorical ?? false,
        historicalDate: options.historicalDate?.toISOString(),
      },
    };
  }

  /**
   * Type guard for currency response
   */
  isCurrencyResponse(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check for common currency fields
    const hasUsdSell = 'usd_sell' in data;
    const hasUsdBuy = 'usd_buy' in data;

    return hasUsdSell || hasUsdBuy;
  }

  /**
   * Type guard for crypto response
   */
  isCryptoResponse(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check for common crypto fields
    const hasBtc = 'btc' in data;
    const hasEth = 'eth' in data;

    return hasBtc || hasEth;
  }

  /**
   * Type guard for gold response
   */
  isGoldResponse(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check for common gold fields
    const hasGoldMesghal = 'gold_mesghal' in data;
    const hasGoldGeram = 'gold_geram18' in data;

    return hasGoldMesghal || hasGoldGeram;
  }

  /**
   * Sanitize error message (remove sensitive data)
   */
  sanitizeErrorMessage(error: any): string {
    let message = error?.message || String(error);

    // Remove URLs
    message = message.replace(/https?:\/\/[^\s]+/g, '[URL]');

    // Remove API keys
    message = message.replace(/api[_-]?key[=:]\s*[\w-]+/gi, 'api_key=[REDACTED]');

    // Remove tokens
    message = message.replace(/token[=:]\s*[\w-]+/gi, 'token=[REDACTED]');

    // Remove IP addresses
    message = message.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');

    return message;
  }

  /**
   * Convert Jalali date to Gregorian (placeholder for actual implementation)
   */
  jalaliToGregorian(jalaliDate: string): Date {
    // TODO: Implement actual Jalali to Gregorian conversion
    // For now, return current date as placeholder
    this.logger.warn('Jalali to Gregorian conversion not implemented - using current date');
    return new Date();
  }

  /**
   * Format number to string with fixed decimals
   */
  private formatNumber(value: any, decimals: number = 2): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(num)) {
      return '0';
    }

    return num.toFixed(decimals);
  }

  /**
   * Extract category from data structure
   */
  extractCategory(data: any): ItemCategory | null {
    if (this.isCurrencyResponse(data)) {
      return 'currencies';
    }

    if (this.isCryptoResponse(data)) {
      return 'crypto';
    }

    if (this.isGoldResponse(data)) {
      return 'gold';
    }

    return null;
  }

  /**
   * Merge multiple data sources (useful for aggregation)
   */
  mergeDataSources(sources: any[]): any {
    if (!Array.isArray(sources) || sources.length === 0) {
      return null;
    }

    // Start with first source
    const merged = { ...sources[0] };

    // Merge remaining sources (later sources override earlier ones)
    for (let i = 1; i < sources.length; i++) {
      Object.assign(merged, sources[i]);
    }

    return merged;
  }

  /**
   * Validate timestamp is within reasonable bounds
   */
  isValidTimestamp(timestamp: number): boolean {
    const now = Date.now();
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
    const oneYearFromNow = now + (365 * 24 * 60 * 60 * 1000);

    return timestamp >= oneYearAgo && timestamp <= oneYearFromNow;
  }

  /**
   * Create error response with standardized format
   */
  createErrorResponse(error: any, category?: ItemCategory): any {
    return {
      error: true,
      message: this.sanitizeErrorMessage(error),
      category,
      timestamp: new Date().toISOString(),
    };
  }
}
