import { Controller, Get, Logger, Res, Query, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { NavasanService } from './navasan.service';
import { parseTehranDate, getTehranToday, validateDateAge, formatTehranDate } from '../common/utils/date-utils';

@Controller('navasan')
export class NavasanController {
  private readonly logger = new Logger(NavasanController.name);

  constructor(private readonly navasanService: NavasanService) {}

  /**
   * Sanitize header value to prevent HTTP header injection
   * SECURITY FIX: Removes newlines, carriage returns, and control characters
   */
  private sanitizeHeaderValue(value: string): string {
    if (!value) return '';
    // Remove newlines, carriage returns, and other control characters
    return value.replace(/[\r\n\x00-\x1f\x7f]/g, '');
  }

  /**
   * GET /api/navasan/latest
   * Returns all latest prices (currencies, crypto, and gold)
   */
  @Get('latest')
  async getLatest(@Res() res: Response) {
    try {
      this.logger.log('GET /api/navasan/latest - Fetching all latest rates');

      const response = await this.navasanService.getLatestRates();

      // Add metadata headers to communicate data freshness
      res.setHeader('X-Data-Fresh', String(response.metadata.isFresh));
      res.setHeader('X-Data-Stale', String(response.metadata.isStale));
      res.setHeader('X-Data-Age-Minutes', String(response.metadata.dataAge || 0));
      res.setHeader('X-Data-Source', response.metadata.source);
      res.setHeader('X-Last-Updated', response.metadata.lastUpdated.toISOString());

      // SECURITY FIX: Sanitize warning message to prevent header injection
      if (response.metadata.warning) {
        res.setHeader('X-Data-Warning', this.sanitizeHeaderValue(response.metadata.warning));
      }

      // Return data with metadata
      return res.json({
        ...response.data,
        _metadata: response.metadata,
      });
    } catch (error) {
      // Re-throw to let NestJS exception filters handle it
      throw error;
    }
  }

  /**
   * Shared handler for historical data requests across all categories
   * Uses Tehran timezone for consistent date handling
   * @private
   */
  private async handleHistoricalRequest(
    category: 'currencies' | 'crypto' | 'gold',
    dateStr: string,
    res: Response
  ) {
    try {
      let targetDate: Date;

      if (dateStr) {
        // Use strict YYYY-MM-DD validation in Tehran timezone
        targetDate = parseTehranDate(dateStr);
      } else {
        // Default to yesterday in Tehran timezone
        targetDate = getTehranToday();
        targetDate.setDate(targetDate.getDate() - 1);
      }

      // Validate age using utility (max 90 days)
      const ageError = validateDateAge(targetDate, 90);
      if (ageError) {
        return res.status(400).json({ error: ageError });
      }

      const formattedDate = formatTehranDate(targetDate);
      this.logger.log(`GET /api/navasan/${category}/historical - Fetching ${category} data for ${formattedDate}`);

      // Fetch data from OHLC snapshots
      const response = await this.navasanService.getHistoricalDataFromOHLC(category, targetDate);

      if (!response || !response.data) {
        throw new NotFoundException(
          `No historical data available for ${formattedDate}`
        );
      }

      // Add metadata headers
      res.setHeader('X-Data-Source', 'ohlc-snapshot');
      res.setHeader('X-Is-Historical', 'true');
      res.setHeader('X-Historical-Date', targetDate.toISOString());
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

      return res.json({
        ...response.data,
        _metadata: {
          ...response.metadata,
          isHistorical: true,
          historicalDate: targetDate.toISOString(),
          source: 'ohlc-snapshot'
        }
      });
    } catch (error) {
      this.logger.error(`Error fetching historical ${category} data:`, error);

      // Preserve NotFoundException (404)
      if (error instanceof NotFoundException) {
        return res.status(404).json({ error: error.message });
      }

      // Handle BadRequestException (thrown by parseTehranDate)
      if (error instanceof BadRequestException) {
        return res.status(400).json({ error: error.message });
      }

      // Database connection errors (503)
      if (error instanceof Error) {
        if (error.name === 'MongoError' || error.message.includes('connection')) {
          return res.status(503).json({
            error: 'Database temporarily unavailable. Please try again later.'
          });
        }
      }

      // Generic 500 for unexpected errors
      return res.status(500).json({
        error: 'Internal server error while fetching historical data'
      });
    }
  }

  /**
   * GET /api/navasan/currencies/historical
   * Returns historical currency rates for a specific date from OHLC snapshots
   *
   * @param date - Optional date in YYYY-MM-DD format. Defaults to yesterday if not provided.
   *
   * This endpoint queries OHLC snapshots stored in our MongoDB database.
   * No external API calls to Navasan are made - all data comes from our DB.
   */
  @Get('currencies/historical')
  async getCurrenciesHistorical(@Query('date') dateStr: string, @Res() res: Response) {
    return this.handleHistoricalRequest('currencies', dateStr, res);
  }

  /**
   * GET /api/navasan/currencies/yesterday
   * Returns yesterday's currency rates from price snapshots or OHLC API
   * IMPORTANT: This must come BEFORE the /currencies route for proper route matching
   *
   * @returns Currency rates from yesterday with metadata
   * @throws {NotFoundException} When no historical data is available for the requested date
   *
   * @example
   * Response body:
   * {
   *   "usd_sell": { "value": "123456", "change": 1500, "utc": "...", "date": "..." },
   *   "eur": { "value": "134567", "change": -500, "utc": "...", "date": "..." },
   *   "_metadata": {
   *     "isFresh": false,
   *     "isStale": true,
   *     "source": "snapshot",
   *     "isHistorical": true,
   *     "historicalDate": "2025-01-09T12:00:00Z"
   *   }
   * }
   *
   * Response headers:
   * - X-Data-Source: 'snapshot' | 'fallback'
   * - X-Is-Historical: 'true'
   * - X-Historical-Date: ISO timestamp of actual data date
   * - X-Data-Warning: Optional warning about data quality
   *
   * Data retrieval logic:
   * 1. Searches database for snapshot within ±6 hours of yesterday
   * 2. Validates snapshot data (checks for corruption, empty data)
   * 3. Falls back to OHLC API if no valid snapshot found
   * 4. Returns 404 if neither source has data
   */
  @Get('currencies/yesterday')
  async getCurrenciesYesterday(@Res() res: Response) {
    try {
      this.logger.log('GET /api/navasan/currencies/yesterday - Fetching yesterday\'s currency rates');

      const response = await this.navasanService.getHistoricalData('currencies');

      res.setHeader('X-Data-Fresh', String(response.metadata.isFresh));
      res.setHeader('X-Data-Stale', String(response.metadata.isStale));
      res.setHeader('X-Data-Age-Minutes', String(response.metadata.dataAge || 0));
      res.setHeader('X-Data-Source', response.metadata.source);
      res.setHeader('X-Last-Updated', response.metadata.lastUpdated.toISOString());
      res.setHeader('X-Is-Historical', 'true');

      if (response.metadata.historicalDate) {
        const dateStr = response.metadata.historicalDate instanceof Date
          ? response.metadata.historicalDate.toISOString()
          : response.metadata.historicalDate;
        res.setHeader('X-Historical-Date', dateStr);
      }

      // SECURITY FIX: Sanitize warning message to prevent header injection
      if (response.metadata.warning) {
        res.setHeader('X-Data-Warning', this.sanitizeHeaderValue(response.metadata.warning));
      }

      return res.json({
        ...response.data,
        _metadata: response.metadata,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /api/navasan/currencies
   * Returns only currency rates (USD, EUR, GBP, CAD, AUD)
   */
  @Get('currencies')
  async getCurrencies(@Res() res: Response) {
    try {
      this.logger.log('GET /api/navasan/currencies - Fetching currency rates');

      const response = await this.navasanService.getCurrencies();

      res.setHeader('X-Data-Fresh', String(response.metadata.isFresh));
      res.setHeader('X-Data-Stale', String(response.metadata.isStale));
      res.setHeader('X-Data-Age-Minutes', String(response.metadata.dataAge || 0));
      res.setHeader('X-Data-Source', response.metadata.source);
      res.setHeader('X-Last-Updated', response.metadata.lastUpdated.toISOString());

      // SECURITY FIX: Sanitize warning message to prevent header injection
      if (response.metadata.warning) {
        res.setHeader('X-Data-Warning', this.sanitizeHeaderValue(response.metadata.warning));
      }

      return res.json({
        ...response.data,
        _metadata: response.metadata,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /api/navasan/crypto/historical
   * Returns historical cryptocurrency rates for a specific date from OHLC snapshots
   *
   * @param date - Optional date in YYYY-MM-DD format. Defaults to yesterday if not provided.
   */
  @Get('crypto/historical')
  async getCryptoHistorical(@Query('date') dateStr: string, @Res() res: Response) {
    return this.handleHistoricalRequest('crypto', dateStr, res);
  }

  /**
   * GET /api/navasan/crypto/yesterday
   * Returns yesterday's cryptocurrency rates from price snapshots or OHLC API
   * IMPORTANT: This must come BEFORE the /crypto route for proper route matching
   */
  @Get('crypto/yesterday')
  async getCryptoYesterday(@Res() res: Response) {
    try {
      this.logger.log('GET /api/navasan/crypto/yesterday - Fetching yesterday\'s crypto rates');

      const response = await this.navasanService.getHistoricalData('crypto');

      res.setHeader('X-Data-Fresh', String(response.metadata.isFresh));
      res.setHeader('X-Data-Stale', String(response.metadata.isStale));
      res.setHeader('X-Data-Age-Minutes', String(response.metadata.dataAge || 0));
      res.setHeader('X-Data-Source', response.metadata.source);
      res.setHeader('X-Last-Updated', response.metadata.lastUpdated.toISOString());
      res.setHeader('X-Is-Historical', 'true');

      if (response.metadata.historicalDate) {
        const dateStr = response.metadata.historicalDate instanceof Date
          ? response.metadata.historicalDate.toISOString()
          : response.metadata.historicalDate;
        res.setHeader('X-Historical-Date', dateStr);
      }

      // SECURITY FIX: Sanitize warning message to prevent header injection
      if (response.metadata.warning) {
        res.setHeader('X-Data-Warning', this.sanitizeHeaderValue(response.metadata.warning));
      }

      return res.json({
        ...response.data,
        _metadata: response.metadata,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /api/navasan/crypto
   * Returns only cryptocurrency rates (USDT, BTC, ETH)
   */
  @Get('crypto')
  async getCrypto(@Res() res: Response) {
    try {
      this.logger.log('GET /api/navasan/crypto - Fetching crypto rates');

      const response = await this.navasanService.getCrypto();

      res.setHeader('X-Data-Fresh', String(response.metadata.isFresh));
      res.setHeader('X-Data-Stale', String(response.metadata.isStale));
      res.setHeader('X-Data-Age-Minutes', String(response.metadata.dataAge || 0));
      res.setHeader('X-Data-Source', response.metadata.source);
      res.setHeader('X-Last-Updated', response.metadata.lastUpdated.toISOString());

      // SECURITY FIX: Sanitize warning message to prevent header injection
      if (response.metadata.warning) {
        res.setHeader('X-Data-Warning', this.sanitizeHeaderValue(response.metadata.warning));
      }

      return res.json({
        ...response.data,
        _metadata: response.metadata,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /api/navasan/gold/historical
   * Returns historical gold prices for a specific date from OHLC snapshots
   *
   * @param date - Optional date in YYYY-MM-DD format. Defaults to yesterday if not provided.
   */
  @Get('gold/historical')
  async getGoldHistorical(@Query('date') dateStr: string, @Res() res: Response) {
    return this.handleHistoricalRequest('gold', dateStr, res);
  }

  /**
   * GET /api/navasan/gold/yesterday
   * Returns yesterday's gold prices from price snapshots or OHLC API
   * IMPORTANT: This must come BEFORE the /gold route for proper route matching
   */
  @Get('gold/yesterday')
  async getGoldYesterday(@Res() res: Response) {
    try {
      this.logger.log('GET /api/navasan/gold/yesterday - Fetching yesterday\'s gold prices');

      const response = await this.navasanService.getHistoricalData('gold');

      res.setHeader('X-Data-Fresh', String(response.metadata.isFresh));
      res.setHeader('X-Data-Stale', String(response.metadata.isStale));
      res.setHeader('X-Data-Age-Minutes', String(response.metadata.dataAge || 0));
      res.setHeader('X-Data-Source', response.metadata.source);
      res.setHeader('X-Last-Updated', response.metadata.lastUpdated.toISOString());
      res.setHeader('X-Is-Historical', 'true');

      if (response.metadata.historicalDate) {
        const dateStr = response.metadata.historicalDate instanceof Date
          ? response.metadata.historicalDate.toISOString()
          : response.metadata.historicalDate;
        res.setHeader('X-Historical-Date', dateStr);
      }

      // SECURITY FIX: Sanitize warning message to prevent header injection
      if (response.metadata.warning) {
        res.setHeader('X-Data-Warning', this.sanitizeHeaderValue(response.metadata.warning));
      }

      return res.json({
        ...response.data,
        _metadata: response.metadata,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /api/navasan/gold
   * Returns gold coin and gold prices (Sekkeh, Bahar, Nim, Rob, Gerami, 18 Karat)
   */
  @Get('gold')
  async getGold(@Res() res: Response) {
    try {
      this.logger.log('GET /api/navasan/gold - Fetching gold prices');

      const response = await this.navasanService.getGold();

      res.setHeader('X-Data-Fresh', String(response.metadata.isFresh));
      res.setHeader('X-Data-Stale', String(response.metadata.isStale));
      res.setHeader('X-Data-Age-Minutes', String(response.metadata.dataAge || 0));
      res.setHeader('X-Data-Source', response.metadata.source);
      res.setHeader('X-Last-Updated', response.metadata.lastUpdated.toISOString());

      // SECURITY FIX: Sanitize warning message to prevent header injection
      if (response.metadata.warning) {
        res.setHeader('X-Data-Warning', this.sanitizeHeaderValue(response.metadata.warning));
      }

      return res.json({
        ...response.data,
        _metadata: response.metadata,
      });
    } catch (error) {
      throw error;
    }
  }
}
