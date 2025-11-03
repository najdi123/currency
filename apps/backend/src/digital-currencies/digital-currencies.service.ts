import { Injectable, Logger } from '@nestjs/common';
import { HistoryService } from '../history/history.service';

@Injectable()
export class DigitalCurrenciesService {
  private readonly logger = new Logger(DigitalCurrenciesService.name);

  constructor(private readonly historyService: HistoryService) {}

  async getHistory(symbol: string, days: number = 7) {
    try {
      this.logger.log(`Fetching real historical data for ${symbol}`);
      const realHistoryData = await this.historyService.getHistory(symbol, 'digital-currency', days);

      if (realHistoryData && realHistoryData.length > 0) {
        this.logger.log(`Successfully fetched ${realHistoryData.length} real data points for ${symbol}`);
        return {
          success: true,
          data: realHistoryData,
          symbol,
        };
      }

      this.logger.warn(`No real historical data available for ${symbol}`);
      return {
        success: false,
        data: [],
        symbol,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to fetch real historical data for ${symbol}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        data: [],
        symbol,
      };
    }
  }
}
