import {
  Controller,
  Get,
  Logger,
  Res,
  Query,
  Param,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  UseGuards,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { MarketDataOrchestratorService } from './market-data-orchestrator.service';
import { IntradayOhlcService } from '../navasan/services/intraday-ohlc.service';
import {
  parseTehranDate,
  getTehranToday,
  validateDateAge,
  formatTehranDate,
} from '../common/utils/date-utils';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { CurrencyConversionService } from '../common/services/currency-conversion.service';

/**
 * MarketDataController
 *
 * New market-data API endpoints (v2, recommended)
 * Route prefix: /api/market-data
 *
 * This controller provides the same functionality as NavasanController
 * but uses the new MarketDataOrchestratorService.
 *
 * For backward compatibility, the NavasanController still exists at /api/navasan
 */
@Controller('market-data')
@UseGuards(RateLimitGuard)
export class MarketDataController {
  private readonly logger = new Logger(MarketDataController.name);

  constructor(
    private readonly orchestratorService: MarketDataOrchestratorService,
    private readonly intradayOhlcService: IntradayOhlcService,
    private readonly currencyConversionService: CurrencyConversionService,
  ) {}

  /**
   * Sanitize header value to prevent HTTP header injection
   */
  private sanitizeHeaderValue(value: string): string {
    if (!value) return '';
    return value.replace(/[\r\n\x00-\x1f\x7f]/g, '');
  }

  /**
   * GET /api/market-data/latest
   * Returns all latest prices (currencies, crypto, and gold)
   */
  @Get('latest')
  async getLatest(@Res() res: Response) {
    try {
      this.logger.log('GET /api/market-data/latest - Fetching all latest rates');

      const response = await this.orchestratorService.getLatestRates();

      this.setResponseHeaders(res, response.metadata);

      return res.json({
        ...response.data,
        _metadata: response.metadata,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Shared handler for historical data requests
   */
  private async handleHistoricalRequest(
    category: 'currencies' | 'crypto' | 'gold',
    dateStr: string,
    res: Response,
  ) {
    try {
      let targetDate: Date;

      if (dateStr) {
        targetDate = parseTehranDate(dateStr);
      } else {
        targetDate = getTehranToday();
        targetDate.setDate(targetDate.getDate() - 1);
      }

      const ageError = validateDateAge(targetDate, 90);
      if (ageError) {
        return res.status(400).json({ error: ageError });
      }

      const formattedDate = formatTehranDate(targetDate);
      this.logger.log(
        `GET /api/market-data/${category}/historical - Fetching data for ${formattedDate}`,
      );

      const response = await this.orchestratorService.getHistoricalDataFromOHLC(
        category,
        targetDate,
      );

      if (!response || !response.data) {
        throw new NotFoundException(
          `No historical data available for ${formattedDate}`,
        );
      }

      res.setHeader('X-Data-Source', 'ohlc-snapshot');
      res.setHeader('X-Is-Historical', 'true');
      res.setHeader('X-Historical-Date', targetDate.toISOString());
      res.setHeader('Cache-Control', 'public, max-age=3600');

      const convertedData = this.currencyConversionService.convertResponse(
        { data: response.data },
        { dataKey: 'data', excludeKeys: ['_metadata'] },
      );

      return res.json({
        ...convertedData.data,
        _metadata: {
          ...response.metadata,
          isHistorical: true,
          historicalDate: targetDate.toISOString(),
          source: 'ohlc-snapshot',
        },
      });
    } catch (error) {
      this.logger.error(`Error fetching historical ${category} data:`, error);

      if (error instanceof NotFoundException) {
        return res.status(404).json({ error: error.message });
      }

      if (error instanceof BadRequestException) {
        return res.status(400).json({ error: error.message });
      }

      if (error instanceof Error) {
        if (error.name === 'MongoError' || error.message.includes('connection')) {
          return res.status(503).json({
            error: 'Database temporarily unavailable. Please try again later.',
          });
        }
      }

      return res.status(500).json({
        error: 'Internal server error while fetching historical data',
      });
    }
  }

  /**
   * Set common response headers
   */
  private setResponseHeaders(res: Response, metadata: any) {
    res.setHeader('X-Data-Fresh', String(metadata.isFresh));
    res.setHeader('X-Data-Stale', String(metadata.isStale));
    res.setHeader('X-Data-Age-Minutes', String(metadata.dataAge || 0));
    res.setHeader('X-Data-Source', metadata.source);

    if (metadata.lastUpdated) {
      const dateStr = metadata.lastUpdated instanceof Date
        ? metadata.lastUpdated.toISOString()
        : metadata.lastUpdated;
      res.setHeader('X-Last-Updated', dateStr);
    }

    if (metadata.warning) {
      res.setHeader('X-Data-Warning', this.sanitizeHeaderValue(metadata.warning));
    }

    if (metadata.isHistorical) {
      res.setHeader('X-Is-Historical', 'true');
    }

    if (metadata.historicalDate) {
      const dateStr = metadata.historicalDate instanceof Date
        ? metadata.historicalDate.toISOString()
        : metadata.historicalDate;
      res.setHeader('X-Historical-Date', dateStr);
    }
  }

  // ==================== CURRENCIES ====================

  @Get('currencies/historical')
  async getCurrenciesHistorical(
    @Query('date') dateStr: string,
    @Res() res: Response,
  ) {
    return this.handleHistoricalRequest('currencies', dateStr, res);
  }

  @Get('currencies/yesterday')
  async getCurrenciesYesterday(@Res() res: Response) {
    try {
      this.logger.log(
        'GET /api/market-data/currencies/yesterday - Fetching yesterday\'s rates',
      );

      const response = await this.orchestratorService.getHistoricalData('currencies');

      this.setResponseHeaders(res, response.metadata);

      const convertedData = this.currencyConversionService.convertResponse(
        { data: response.data },
        { dataKey: 'data', excludeKeys: ['_metadata'] },
      );

      return res.json({
        ...convertedData.data,
        _metadata: response.metadata,
      });
    } catch (error) {
      throw error;
    }
  }

  @Get('currencies')
  async getCurrencies(@Res() res: Response) {
    try {
      this.logger.log('GET /api/market-data/currencies - Fetching currency rates');

      const response = await this.orchestratorService.getCurrencies();

      const convertedData = this.currencyConversionService.convertResponse(
        { data: response.data },
        { dataKey: 'data', excludeKeys: ['_metadata'] },
      );

      this.setResponseHeaders(res, response.metadata);

      return res.json({
        ...convertedData.data,
        _metadata: response.metadata,
      });
    } catch (error) {
      throw error;
    }
  }

  // ==================== CRYPTO ====================

  @Get('crypto/historical')
  async getCryptoHistorical(
    @Query('date') dateStr: string,
    @Res() res: Response,
  ) {
    return this.handleHistoricalRequest('crypto', dateStr, res);
  }

  @Get('crypto/yesterday')
  async getCryptoYesterday(@Res() res: Response) {
    try {
      this.logger.log(
        'GET /api/market-data/crypto/yesterday - Fetching yesterday\'s rates',
      );

      const response = await this.orchestratorService.getHistoricalData('crypto');

      this.setResponseHeaders(res, response.metadata);

      const convertedData = this.currencyConversionService.convertResponse(
        { data: response.data },
        { dataKey: 'data', excludeKeys: ['_metadata'] },
      );

      return res.json({
        ...convertedData.data,
        _metadata: response.metadata,
      });
    } catch (error) {
      throw error;
    }
  }

  @Get('crypto')
  async getCrypto(@Res() res: Response) {
    try {
      this.logger.log('GET /api/market-data/crypto - Fetching crypto rates');

      const response = await this.orchestratorService.getCrypto();

      const convertedData = this.currencyConversionService.convertResponse(
        { data: response.data },
        { dataKey: 'data', excludeKeys: ['_metadata'] },
      );

      this.setResponseHeaders(res, response.metadata);

      return res.json({
        ...convertedData.data,
        _metadata: response.metadata,
      });
    } catch (error) {
      throw error;
    }
  }

  // ==================== GOLD ====================

  @Get('gold/historical')
  async getGoldHistorical(
    @Query('date') dateStr: string,
    @Res() res: Response,
  ) {
    return this.handleHistoricalRequest('gold', dateStr, res);
  }

  @Get('gold/yesterday')
  async getGoldYesterday(@Res() res: Response) {
    try {
      this.logger.log(
        'GET /api/market-data/gold/yesterday - Fetching yesterday\'s prices',
      );

      const response = await this.orchestratorService.getHistoricalData('gold');

      this.setResponseHeaders(res, response.metadata);

      const convertedData = this.currencyConversionService.convertResponse(
        { data: response.data },
        { dataKey: 'data', excludeKeys: ['_metadata'] },
      );

      return res.json({
        ...convertedData.data,
        _metadata: response.metadata,
      });
    } catch (error) {
      throw error;
    }
  }

  @Get('gold')
  async getGold(@Res() res: Response) {
    try {
      this.logger.log('GET /api/market-data/gold - Fetching gold prices');

      const response = await this.orchestratorService.getGold();

      const convertedData = this.currencyConversionService.convertResponse(
        { data: response.data },
        { dataKey: 'data', excludeKeys: ['_metadata'] },
      );

      this.setResponseHeaders(res, response.metadata);

      return res.json({
        ...convertedData.data,
        _metadata: response.metadata,
      });
    } catch (error) {
      throw error;
    }
  }

  // ==================== COINS ====================

  @Get('coins')
  async getCoins(@Res() res: Response) {
    try {
      this.logger.log('GET /api/market-data/coins - Fetching coin prices');

      const response = await this.orchestratorService.getCoins();

      this.setResponseHeaders(res, response.metadata);

      return res.json({
        ...response.data,
        _metadata: response.metadata,
      });
    } catch (error) {
      throw error;
    }
  }

  // ==================== OHLC ====================

  @Get('ohlc/today/:itemCode')
  async getTodayOhlc(
    @Param('itemCode') itemCode: string,
    @Res() res: Response,
  ) {
    try {
      if (!itemCode || typeof itemCode !== 'string') {
        throw new BadRequestException('Invalid item code');
      }

      const safePattern = /^[a-zA-Z0-9_-]{1,50}$/;
      if (!safePattern.test(itemCode)) {
        throw new BadRequestException('Item code contains invalid characters');
      }

      this.logger.log(
        `GET /api/market-data/ohlc/today/${itemCode} - Fetching OHLC data`,
      );

      const ohlc = await this.intradayOhlcService.getTodayOhlc(itemCode);

      if (!ohlc) {
        throw new NotFoundException(`No OHLC data found for item: ${itemCode}`);
      }

      const changePercent =
        await this.intradayOhlcService.getDailyChangePercent(itemCode);

      return res.json({
        itemCode: ohlc.itemCode,
        date: ohlc.date,
        dateJalali: ohlc.dateJalali,
        open: ohlc.open,
        high: ohlc.high,
        low: ohlc.low,
        close: ohlc.close,
        change: changePercent,
        dataPoints: ohlc.dataPoints,
        updateCount: ohlc.updateCount,
        firstUpdate: ohlc.firstUpdate,
        lastUpdate: ohlc.lastUpdate,
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(
        `Error fetching OHLC for ${itemCode}: ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException('Failed to fetch OHLC data');
    }
  }

  @Get('ohlc/all')
  async getAllTodayOhlc(@Res() res: Response) {
    try {
      this.logger.log(
        'GET /api/market-data/ohlc/all - Fetching all OHLC data',
      );

      const allOhlc = await this.intradayOhlcService.getAllTodayOhlc();

      const ohlcWithChanges = allOhlc.map((ohlc) => {
        const changePercent =
          ohlc.open > 0
            ? parseFloat((((ohlc.close - ohlc.open) / ohlc.open) * 100).toFixed(2))
            : 0;
        const absoluteChangeToman = Math.round((ohlc.close - ohlc.open) / 10);

        return {
          itemCode: ohlc.itemCode,
          date: ohlc.date,
          dateJalali: ohlc.dateJalali,
          open: ohlc.open,
          high: ohlc.high,
          low: ohlc.low,
          close: ohlc.close,
          change: changePercent,
          absoluteChange: absoluteChangeToman,
          dataPoints: ohlc.dataPoints,
          updateCount: ohlc.updateCount,
          lastUpdate: ohlc.lastUpdate,
        };
      });

      return res.json({
        count: ohlcWithChanges.length,
        data: ohlcWithChanges,
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error fetching all OHLC: ${err.message}`, err.stack);
      throw new InternalServerErrorException('Failed to fetch OHLC data');
    }
  }
}
