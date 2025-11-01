import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ChartService } from './chart.service';
import { ChartQueryDto } from './dto/chart-query.dto';
import { ChartResponse } from './interfaces/chart.interface';

@Controller('chart')
export class ChartController {
  private readonly logger = new Logger(ChartController.name);

  constructor(private readonly chartService: ChartService) {}

  /**
   * GET /api/chart/:currencyCode
   * Returns historical OHLC chart data for a currency, crypto, or gold item
   *
   * @param currencyCode - The currency/crypto/gold code (e.g., 'USD', 'BTC', 'SEKKEH')
   * @param query - Query parameters (timeRange, itemType)
   * @returns ChartResponse with OHLC data points
   *
   * @example
   * GET /api/chart/USD?timeRange=1w&itemType=currency
   * GET /api/chart/BTC?timeRange=1m&itemType=crypto
   * GET /api/chart/SEKKEH?timeRange=1y&itemType=gold
   */
  @Get(':currencyCode')
  async getChartData(
    @Param('currencyCode') currencyCode: string,
    @Query() query: ChartQueryDto,
  ): Promise<ChartResponse> {
    // Validate currency code
    if (!currencyCode || currencyCode.trim().length === 0) {
      throw new BadRequestException('Currency code is required');
    }

    if (currencyCode.length > 20) {
      throw new BadRequestException('Currency code too long (max 20 characters)');
    }

    this.logger.log(
      `GET /api/chart/${currencyCode}?timeRange=${query.timeRange}&itemType=${query.itemType}`,
    );

    return this.chartService.getChartData(
      currencyCode.trim(),
      query.timeRange,
      query.itemType,
    );
  }
}
