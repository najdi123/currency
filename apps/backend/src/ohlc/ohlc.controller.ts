import { Controller, Get, Post, Param, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { OHLCManagerService } from './ohlc-manager.service';
import { OHLCCollectorService } from './ohlc-collector.service';
import { OHLCUpdateService } from './ohlc-update.service';

@Controller('api/ohlc')
export class OHLCController {
  constructor(
    private readonly ohlcManager: OHLCManagerService,
    private readonly ohlcCollector: OHLCCollectorService,
    private readonly ohlcUpdate: OHLCUpdateService,
  ) {}

  /**
   * Get OHLC data for a specific item
   */
  @Get(':itemCode')
  async getOHLCData(
    @Param('itemCode') itemCode: string,
    @Query('itemType') itemType: string = 'currency',
    @Query('timeframe') timeframe: string = '1h',
    @Query('days') days: string = '30',
  ) {
    try {
      const endDate = new Date();
      const daysNum = parseInt(days, 10) || 30;
      const startDate = new Date(endDate.getTime() - daysNum * 86400000);

      const data = await this.ohlcManager.getOHLCData(
        itemCode,
        itemType as 'currency' | 'crypto' | 'gold',
        timeframe,
        startDate,
        endDate,
      );

      return {
        success: true,
        itemCode,
        itemType,
        timeframe,
        period: { start: startDate, end: endDate },
        count: data.length,
        data,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch OHLC data: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get data coverage report
   */
  @Get(':itemCode/coverage')
  async getDataCoverage(
    @Param('itemCode') itemCode: string,
    @Query('itemType') itemType: string = 'currency',
    @Query('timeframe') timeframe: string = '1h',
    @Query('days') days: string = '30',
  ) {
    try {
      const endDate = new Date();
      const daysNum = parseInt(days, 10) || 30;
      const startDate = new Date(endDate.getTime() - daysNum * 86400000);

      const coverage = await this.ohlcManager.getDataCoverage(
        itemCode,
        itemType as 'currency' | 'crypto' | 'gold',
        timeframe,
        startDate,
        endDate,
      );

      return {
        success: true,
        itemCode,
        itemType,
        timeframe,
        period: { start: startDate, end: endDate },
        ...coverage,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get coverage report: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get data quality report
   */
  @Get(':itemCode/quality')
  async getDataQuality(
    @Param('itemCode') itemCode: string,
    @Query('itemType') itemType: string = 'currency',
    @Query('timeframe') timeframe: string = '1h',
    @Query('days') days: string = '30',
  ) {
    try {
      const daysNum = parseInt(days, 10) || 30;

      const quality = await this.ohlcUpdate.getDataQualityReport(
        itemCode,
        itemType as 'currency' | 'crypto' | 'gold',
        timeframe,
        daysNum,
      );

      return {
        success: true,
        itemCode,
        itemType,
        timeframe,
        days: daysNum,
        ...quality,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get quality report: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Trigger backfill for an item (Admin only - add authentication in production)
   */
  @Post('backfill/:itemCode')
  async triggerBackfill(
    @Param('itemCode') itemCode: string,
    @Query('itemType') itemType: string = 'currency',
    @Query('timeRange') timeRange: string = '1m',
  ) {
    try {
      await this.ohlcCollector.backfillHistoricalData(
        itemCode,
        itemType as 'currency' | 'crypto' | 'gold',
        timeRange,
      );

      return {
        success: true,
        message: `Backfill initiated for ${itemCode}`,
        itemCode,
        itemType,
        timeRange,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to initiate backfill: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Trigger backfill for all items (Admin only - add authentication in production)
   */
  @Post('backfill-all')
  async triggerBackfillAll() {
    try {
      // Run in background
      this.ohlcCollector.backfillRecentData().catch(error => {
        console.error('Backfill failed:', error);
      });

      return {
        success: true,
        message: 'Backfill initiated for all items (running in background)',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to initiate backfill: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Manually trigger data collection (Admin only)
   */
  @Post('collect-now')
  async collectNow() {
    try {
      await this.ohlcCollector.collectMinuteData();

      return {
        success: true,
        message: 'Data collection completed',
        timestamp: new Date(),
      };
    } catch (error) {
      throw new HttpException(
        `Failed to collect data: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Manually trigger aggregation (Admin only)
   */
  @Post('aggregate-now')
  async aggregateNow() {
    try {
      await this.ohlcCollector.aggregateTimeframes();

      return {
        success: true,
        message: 'Aggregation completed',
        timestamp: new Date(),
      };
    } catch (error) {
      throw new HttpException(
        `Failed to aggregate: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update OHLC data with current price (used by other services)
   */
  @Post('update/:itemCode')
  async updateOHLC(
    @Param('itemCode') itemCode: string,
    @Body() body: { price: number; itemType?: string },
  ) {
    try {
      const { price, itemType = 'currency' } = body;

      if (!price || price <= 0) {
        throw new HttpException('Invalid price', HttpStatus.BAD_REQUEST);
      }

      await this.ohlcUpdate.updateTodayData(
        itemCode,
        itemType as 'currency' | 'crypto' | 'gold',
        price,
      );

      return {
        success: true,
        message: `Updated OHLC for ${itemCode}`,
        itemCode,
        price,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to update OHLC: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get latest OHLC record
   */
  @Get(':itemCode/latest')
  async getLatestOHLC(
    @Param('itemCode') itemCode: string,
    @Query('itemType') itemType: string = 'currency',
    @Query('timeframe') timeframe: string = '1h',
  ) {
    try {
      const latest = await this.ohlcManager.getLatestOHLC(
        itemCode,
        itemType as 'currency' | 'crypto' | 'gold',
        timeframe,
      );

      if (!latest) {
        return {
          success: false,
          message: 'No data found',
          itemCode,
          itemType,
          timeframe,
        };
      }

      return {
        success: true,
        itemCode,
        itemType,
        timeframe,
        data: latest,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get latest OHLC: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Fill missing data for an item
   */
  @Post('fill-gaps/:itemCode')
  async fillGaps(
    @Param('itemCode') itemCode: string,
    @Query('itemType') itemType: string = 'currency',
    @Query('timeframe') timeframe: string = '1h',
    @Query('days') days: string = '30',
  ) {
    try {
      const endDate = new Date();
      const daysNum = parseInt(days, 10) || 30;
      const startDate = new Date(endDate.getTime() - daysNum * 86400000);

      await this.ohlcManager.fillMissingData(
        itemCode,
        itemType as 'currency' | 'crypto' | 'gold',
        timeframe,
        startDate,
        endDate,
      );

      return {
        success: true,
        message: `Filled gaps for ${itemCode}`,
        itemCode,
        itemType,
        timeframe,
        period: { start: startDate, end: endDate },
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fill gaps: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}