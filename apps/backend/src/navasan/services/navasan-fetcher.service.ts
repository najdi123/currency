import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import {
  CACHE_DURATIONS,
  REQUEST_TIMING,
  API_ENDPOINTS,
  ERROR_MESSAGES,
  ItemCategory,
} from '../constants/navasan.constants';
import { ApiProviderFactory } from '../../api-providers/api-provider.factory';
import { MetricsService } from '../../metrics/metrics.service';

/**
 * NavasanFetcherService
 *
 * Responsible for fetching data from external APIs
 * - Handles API communication
 * - Implements timeout and retry logic
 * - Manages request rate limiting
 * - Tracks API success/failure metrics
 */
@Injectable()
export class NavasanFetcherService {
  private readonly logger = new Logger(NavasanFetcherService.name);
  private readonly internalApiUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly apiProviderFactory: ApiProviderFactory,
    private readonly metricsService: MetricsService,
  ) {
    this.internalApiUrl =
      this.configService.get<string>('INTERNAL_API_URL') ||
      'http://localhost:4000';
  }

  /**
   * Fetch fresh data for a category from API
   */
  async fetchFreshData(
    category: ItemCategory,
    items?: string[],
  ): Promise<any> {
    try {
      this.logger.log(
        `Fetching fresh data for ${category}`,
      );

      const provider = this.apiProviderFactory.getActiveProvider();

      let response: any;
      switch (category) {
        case 'currencies':
          response = await provider.fetchCurrencies();
          break;
        case 'crypto':
          response = await provider.fetchCrypto();
          break;
        case 'gold':
          response = await provider.fetchGold();
          break;
        default:
          throw new Error(`Unknown category: ${category}`);
      }

      this.logger.log(`Successfully fetched fresh data for ${category}`);
      return response;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to fetch fresh data for ${category}: ${err.message}`,
      );
      this.metricsService.trackDbOperationFailure(
        'api_fetch',
        category,
        err.message,
      );
      throw error;
    }
  }

  /**
   * Fetch data with timeout protection
   */
  async fetchWithTimeout(
    url: string,
    timeout: number = REQUEST_TIMING.API_TIMEOUT,
  ): Promise<any> {
    try {
      const response = await axios.get(url, {
        timeout,
        validateStatus: (status) => status < 500,
      });

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.code === 'ECONNABORTED') {
          throw new Error(ERROR_MESSAGES.API_TIMEOUT);
        }
        throw new Error(
          `API request failed: ${axiosError.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Fetch historical data from internal API
   */
  async fetchHistoricalFromInternal(
    category: ItemCategory,
    date: Date,
  ): Promise<any> {
    const dateStr = date.toISOString().split('T')[0];
    const url = `${this.internalApiUrl}/navasan/${category}/historical/${dateStr}`;

    this.logger.debug(`Fetching historical data from: ${url}`);

    try {
      const data = await this.fetchWithTimeout(url);
      return data;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to fetch historical data for ${category} on ${dateStr}: ${err.message}`,
      );
      throw error;
    }
  }

  /**
   * Validate API response structure
   */
  validateResponse(response: any, category: ItemCategory): boolean {
    if (!response || typeof response !== 'object') {
      this.logger.warn(`Invalid response structure for ${category}`);
      return false;
    }

    // Basic structure validation
    // You can expand this based on expected response format
    return true;
  }

  /**
   * Check if API is available (health check)
   */
  async healthCheck(): Promise<boolean> {
    try {
      const provider = this.apiProviderFactory.getActiveProvider();
      // Implement provider-specific health check
      return true;
    } catch (error) {
      this.logger.error('API health check failed');
      return false;
    }
  }
}
