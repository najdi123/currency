import { Injectable, Logger } from '@nestjs/common';
import pLimit from 'p-limit';
import { REQUEST_TIMING, ItemCategory } from '../constants/navasan.constants';
import { NavasanFetcherService } from './navasan-fetcher.service';
import { NavasanCacheManagerService } from './navasan-cache-manager.service';
import { NavasanOhlcService } from './navasan-ohlc.service';
import { NavasanTransformerService } from './navasan-transformer.service';

/**
 * NavasanHistoricalService
 *
 * Responsible for historical data operations
 * - Fetches historical data from multiple sources
 * - Implements request deduplication
 * - Manages multi-source data aggregation
 * - Validates historical data
 * - Handles snapshot creation
 */
@Injectable()
export class NavasanHistoricalService {
  private readonly logger = new Logger(NavasanHistoricalService.name);
  private readonly limit = pLimit(REQUEST_TIMING.MAX_CONCURRENT);

  // Request deduplication map
  private pendingHistoricalRequests = new Map<
    string,
    Promise<any>
  >();

  constructor(
    private readonly fetcherService: NavasanFetcherService,
    private readonly cacheManager: NavasanCacheManagerService,
    private readonly ohlcService: NavasanOhlcService,
    private readonly transformerService: NavasanTransformerService,
  ) {}

  /**
   * Get historical data for a specific date
   * Tries: Cache -> OHLC -> Internal API
   */
  async getHistoricalData(
    category: ItemCategory,
    date: Date,
  ): Promise<any | null> {
    const dateStr = date.toISOString().split('T')[0];
    const requestKey = `${category}:${dateStr}`;

    // Check if request is already pending (deduplication)
    if (this.pendingHistoricalRequests.has(requestKey)) {
      this.logger.debug(`Deduplicating historical request for ${requestKey}`);
      return this.pendingHistoricalRequests.get(requestKey)!;
    }

    // Create new request promise
    const requestPromise = this.fetchHistoricalDataInternal(category, date);

    // Store in pending map
    this.pendingHistoricalRequests.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Remove from pending map after completion
      this.pendingHistoricalRequests.delete(requestKey);
    }
  }

  /**
   * Internal method to fetch historical data
   */
  private async fetchHistoricalDataInternal(
    category: ItemCategory,
    date: Date,
  ): Promise<any | null> {
    // Step 1: Check cache
    const cached = await this.cacheManager.getHistoricalData(category, date);
    if (cached) {
      return this.transformerService.addMetadata(cached, {
        source: 'cache',
        category,
      });
    }

    // Step 2: Try OHLC database
    const ohlcData = await this.ohlcService.getOhlcForDate(category, date);
    if (ohlcData) {
      const response = this.transformerService.addMetadata(ohlcData, {
        source: 'ohlc',
        category,
        isHistorical: true,
        historicalDate: date,
      });

      // Cache the result
      await this.cacheManager.setHistoricalData(category, date, response);

      return response;
    }

    // Step 3: Try internal API
    try {
      const apiData = await this.fetcherService.fetchHistoricalFromInternal(
        category,
        date,
      );

      if (apiData) {
        const response = this.transformerService.addMetadata(apiData, {
          source: 'api',
          category,
          isHistorical: true,
          historicalDate: date,
        });

        // Cache the result
        await this.cacheManager.setHistoricalData(category, date, response);

        return response;
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error fetching historical data from API for ${category}:${date.toISOString()}: ${err.message}`,
      );
    }

    // No data found
    this.logger.warn(`No historical data found for ${category} on ${date.toISOString()}`);
    return null;
  }

  /**
   * Get historical data for multiple dates
   */
  async getHistoricalRange(
    category: ItemCategory,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    const dates = this.generateDateRange(startDate, endDate);

    this.logger.log(
      `Fetching historical data for ${category}: ${dates.length} days`,
    );

    // Fetch all dates with rate limiting
    const results = await Promise.all(
      dates.map((date) =>
        this.limit(() => this.getHistoricalData(category, date)),
      ),
    );

    // Filter out null results
    return results.filter((r) => r !== null);
  }

  /**
   * Get historical data for the last N days
   */
  async getLastNDays(category: ItemCategory, days: number): Promise<any[]> {
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    return this.getHistoricalRange(category, startDate, endDate);
  }

  /**
   * Validate historical data response
   */
  validateHistoricalData(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check for required fields
    if (!data.timestamp && !data.date) {
      this.logger.warn('Historical data missing timestamp field');
      return false;
    }

    return true;
  }

  /**
   * Merge historical data from multiple sources
   */
  mergeHistoricalSources(sources: any[]): any[] {
    if (!Array.isArray(sources) || sources.length === 0) {
      return [];
    }

    // Create map by date for deduplication
    const byDate = new Map<string, any>();

    for (const sourceData of sources) {
      if (Array.isArray(sourceData)) {
        for (const item of sourceData) {
          const dateKey = this.extractDateKey(item);
          if (dateKey && !byDate.has(dateKey)) {
            byDate.set(dateKey, item);
          }
        }
      }
    }

    // Convert map back to array and sort by date
    return Array.from(byDate.values()).sort((a, b) => {
      const dateA = new Date(a.timestamp || a.date).getTime();
      const dateB = new Date(b.timestamp || b.date).getTime();
      return dateA - dateB;
    });
  }

  /**
   * Extract date key from historical data item
   */
  private extractDateKey(item: any): string | null {
    if (!item) {
      return null;
    }

    const timestamp = item.timestamp || item.date;
    if (!timestamp) {
      return null;
    }

    const date = new Date(timestamp);
    return date.toISOString().split('T')[0];
  }

  /**
   * Generate array of dates between start and end
   */
  private generateDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Clear pending requests (for testing/cleanup)
   */
  clearPendingRequests(): void {
    this.logger.log('Clearing pending historical requests');
    this.pendingHistoricalRequests.clear();
  }

  /**
   * Get statistics about pending requests
   */
  getPendingRequestsStats(): {
    count: number;
    requests: string[];
  } {
    return {
      count: this.pendingHistoricalRequests.size,
      requests: Array.from(this.pendingHistoricalRequests.keys()),
    };
  }
}
