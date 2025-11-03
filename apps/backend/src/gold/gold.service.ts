import { Injectable, Logger } from '@nestjs/common';
import { HistoryService } from '../history/history.service';

@Injectable()
export class GoldService {
  private readonly logger = new Logger(GoldService.name);

  constructor(private readonly historyService: HistoryService) {}

  async getHistory(code: string, days: number = 7) {
    try {
      this.logger.log(`Fetching real historical data for ${code}`);
      const realHistoryData = await this.historyService.getHistory(code, 'gold', days);

      if (realHistoryData && realHistoryData.length > 0) {
        this.logger.log(`Successfully fetched ${realHistoryData.length} real data points for ${code}`);
        return {
          success: true,
          data: realHistoryData,
          code,
        };
      }

      this.logger.warn(`No real historical data available for ${code}`);
      return {
        success: false,
        data: [],
        code,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to fetch real historical data for ${code}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        data: [],
        code,
      };
    }
  }
}
