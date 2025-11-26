import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { NavasanModule } from "../navasan/navasan.module";
import { MarketDataModule } from "../market-data/market-data.module";
import { ChartModule } from "../chart/chart.module";
import { OHLCManagerService } from "./ohlc-manager.service";
import { OHLCCollectorService } from "./ohlc-collector.service";
import { OHLCUpdateService } from "./ohlc-update.service";
import { OHLCController } from "./ohlc.controller";

@Module({
  imports: [
    ScheduleModule.forRoot(), // Required for @Cron decorators in OHLCCollectorService
    NavasanModule, // For access to schemas (still needed for schema exports)
    MarketDataModule, // For MarketDataOrchestratorService
    ChartModule, // For ChartService
  ],
  controllers: [OHLCController],
  providers: [OHLCManagerService, OHLCCollectorService, OHLCUpdateService],
  exports: [OHLCManagerService, OHLCCollectorService, OHLCUpdateService],
})
export class OHLCModule {}
