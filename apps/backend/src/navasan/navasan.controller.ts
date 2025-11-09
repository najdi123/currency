import { Controller, Get, Logger, Res } from '@nestjs/common';
import { Response } from 'express';
import { NavasanService } from './navasan.service';

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
   * GET /api/navasan/currencies/yesterday
   * Returns yesterday's currency rates from price snapshots or OHLC API
   * IMPORTANT: This must come BEFORE the /currencies route for proper route matching
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
        res.setHeader('X-Historical-Date', response.metadata.historicalDate.toISOString());
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
        res.setHeader('X-Historical-Date', response.metadata.historicalDate.toISOString());
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
        res.setHeader('X-Historical-Date', response.metadata.historicalDate.toISOString());
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
