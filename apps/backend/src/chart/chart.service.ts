import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TimeRange, ItemType } from './dto/chart-query.dto';
import { ChartDataPoint, ChartResponse } from './interfaces/chart.interface';

/**
 * Simple seeded random number generator for deterministic data
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}

@Injectable()
export class ChartService {
  private readonly logger = new Logger(ChartService.name);

  // Base prices for different currency codes (in Toman)
  private readonly basePrices: Record<string, number> = {
    // Currencies
    USD: 650000,
    EUR: 700000,
    GBP: 820000,
    CAD: 480000,
    AUD: 430000,
    AED: 177000,
    CHF: 750000,
    CNY: 90000,
    JPY: 4300,
    TRY: 19000,

    // Cryptocurrencies
    BTC: 4500000000, // 4.5 billion toman
    ETH: 180000000, // 180 million toman
    USDT: 650000,
    BNB: 35000000,
    XRP: 3500,
    ADA: 2500,
    SOL: 85000000,
    DOGE: 800,

    // Gold items
    SEKKEH: 58000000, // Bahar Azadi coin
    BAHAR: 58000000,
    NIM: 32000000,
    ROB: 17000000,
    GERAMI: 7200000,
    '18AYAR': 7200000, // 18 karat gold per gram
    COIN: 58000000,
    GOLD: 7200000,
  };

  /**
   * Get chart data for a specific currency code
   */
  async getChartData(
    currencyCode: string,
    timeRange: TimeRange = TimeRange.ONE_MONTH,
    itemType: ItemType = ItemType.CURRENCY,
  ): Promise<ChartResponse> {
    this.logger.log(
      `Fetching chart data for ${currencyCode} (${itemType}) with timeRange: ${timeRange}`,
    );

    // Validate currency code
    const upperCode = currencyCode.toUpperCase();
    if (!this.isValidCurrencyCode(upperCode, itemType)) {
      throw new NotFoundException(
        `Currency code "${currencyCode}" not found for item type "${itemType}"`,
      );
    }

    // Get base price
    const basePrice = this.getBasePrice(upperCode, itemType);

    // Generate chart data
    const data = this.generateChartData(upperCode, timeRange, basePrice);

    return {
      data,
      count: data.length,
    };
  }

  /**
   * Validate if currency code exists for the given item type
   */
  private isValidCurrencyCode(code: string, itemType: ItemType): boolean {
    const validCodes = {
      [ItemType.CURRENCY]: [
        'USD',
        'EUR',
        'GBP',
        'CAD',
        'AUD',
        'AED',
        'CHF',
        'CNY',
        'JPY',
        'TRY',
      ],
      [ItemType.CRYPTO]: [
        'BTC',
        'ETH',
        'USDT',
        'BNB',
        'XRP',
        'ADA',
        'SOL',
        'DOGE',
      ],
      [ItemType.GOLD]: [
        'SEKKEH',
        'BAHAR',
        'NIM',
        'ROB',
        'GERAMI',
        '18AYAR',
        'COIN',
        'GOLD',
      ],
    };

    return validCodes[itemType].includes(code);
  }

  /**
   * Get base price for a currency code
   */
  private getBasePrice(code: string, itemType: ItemType): number {
    // Return base price if available, otherwise generate one based on item type
    if (this.basePrices[code]) {
      return this.basePrices[code];
    }

    // Default prices by type
    const defaults = {
      [ItemType.CURRENCY]: 500000,
      [ItemType.CRYPTO]: 100000000,
      [ItemType.GOLD]: 10000000,
    };

    return defaults[itemType];
  }

  /**
   * Generate mock chart data with realistic OHLC values
   */
  private generateChartData(
    currencyCode: string,
    timeRange: TimeRange,
    basePrice: number,
  ): ChartDataPoint[] {
    const numPoints = this.getNumPoints(timeRange);
    const seed = this.hashString(currencyCode);
    const rng = new SeededRandom(seed);

    // Start from historical date based on time range
    const endDate = new Date();
    const startDate = this.getStartDate(timeRange, endDate);

    const dataPoints: ChartDataPoint[] = [];
    let currentPrice = basePrice * 0.85; // Start at 85% of current price for historical data

    // Calculate time increment between points
    const totalMs = endDate.getTime() - startDate.getTime();
    const timeIncrement = totalMs / numPoints;

    for (let i = 0; i < numPoints; i++) {
      const timestamp = new Date(startDate.getTime() + i * timeIncrement);

      // Generate volatility based on item type and time range
      const volatility = this.getVolatility(timeRange);

      // Generate price change (random walk)
      const change = (rng.next() - 0.48) * volatility; // Slight upward bias
      const open = currentPrice;
      const close = currentPrice * (1 + change);

      // Generate high and low with realistic spread
      const spreadMultiplier = 0.005 + rng.next() * 0.015; // 0.5% to 2% spread
      const high = Math.max(open, close) * (1 + spreadMultiplier * rng.next());
      const low = Math.min(open, close) * (1 - spreadMultiplier * rng.next());

      // Generate volume
      const volume = Math.floor(10000 + rng.next() * 490000);

      dataPoints.push({
        timestamp: timestamp.toISOString(),
        open: Math.round(open),
        high: Math.round(high),
        low: Math.round(low),
        close: Math.round(close),
        volume,
      });

      currentPrice = close;
    }

    // Gradually adjust to reach base price at the end
    return this.adjustToTargetPrice(dataPoints, basePrice);
  }

  /**
   * Get number of data points based on time range
   */
  private getNumPoints(timeRange: TimeRange): number {
    const pointsMap = {
      [TimeRange.ONE_DAY]: 24, // Hourly data
      [TimeRange.ONE_WEEK]: 7, // Daily data
      [TimeRange.ONE_MONTH]: 30, // Daily data
      [TimeRange.THREE_MONTHS]: 45, // Every 2 days
      [TimeRange.ONE_YEAR]: 52, // Weekly data
      [TimeRange.ALL]: 150, // Spanning 2-3 years
    };

    return pointsMap[timeRange];
  }

  /**
   * Get volatility based on time range
   */
  private getVolatility(timeRange: TimeRange): number {
    const volatilityMap = {
      [TimeRange.ONE_DAY]: 0.01, // 1% per hour
      [TimeRange.ONE_WEEK]: 0.02, // 2% per day
      [TimeRange.ONE_MONTH]: 0.025, // 2.5% per day
      [TimeRange.THREE_MONTHS]: 0.03, // 3% per 2 days
      [TimeRange.ONE_YEAR]: 0.04, // 4% per week
      [TimeRange.ALL]: 0.05, // 5% per multi-day period
    };

    return volatilityMap[timeRange];
  }

  /**
   * Get start date based on time range
   */
  private getStartDate(timeRange: TimeRange, endDate: Date): Date {
    const startDate = new Date(endDate);

    switch (timeRange) {
      case TimeRange.ONE_DAY:
        startDate.setDate(endDate.getDate() - 1);
        break;
      case TimeRange.ONE_WEEK:
        startDate.setDate(endDate.getDate() - 7);
        break;
      case TimeRange.ONE_MONTH:
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case TimeRange.THREE_MONTHS:
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case TimeRange.ONE_YEAR:
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case TimeRange.ALL:
        startDate.setFullYear(endDate.getFullYear() - 3);
        break;
    }

    return startDate;
  }

  /**
   * Adjust prices to gradually reach target price at the end
   */
  private adjustToTargetPrice(
    dataPoints: ChartDataPoint[],
    targetPrice: number,
  ): ChartDataPoint[] {
    if (dataPoints.length === 0) return dataPoints;

    const lastPrice = dataPoints[dataPoints.length - 1].close;
    const priceGap = targetPrice - lastPrice;

    // Gradually adjust each point to reach target
    return dataPoints.map((point, index) => {
      const progress = (index + 1) / dataPoints.length;
      const adjustment = priceGap * progress;

      return {
        ...point,
        open: Math.round(point.open + adjustment),
        high: Math.round(point.high + adjustment),
        low: Math.round(point.low + adjustment),
        close: Math.round(point.close + adjustment),
      };
    });
  }

  /**
   * Hash string to number for seeded random generation
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
