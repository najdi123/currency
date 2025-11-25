import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { NavasanModule } from "../navasan/navasan.module";
import { ChartModule } from "../chart/chart.module";
import { OHLCManagerService } from "./ohlc-manager.service";
import { OHLCCollectorService } from "./ohlc-collector.service";
import { OHLCUpdateService } from "./ohlc-update.service";
import { OHLCController } from "./ohlc.controller";

@Module({
  imports: [
    ScheduleModule.forRoot(), // Required for @Cron decorators in OHLCCollectorService
    NavasanModule, // For access to schemas and NavasanService
    ChartModule, // For ChartService
  ],
  controllers: [OHLCController],
  providers: [OHLCManagerService, OHLCCollectorService, OHLCUpdateService],
  exports: [OHLCManagerService, OHLCCollectorService, OHLCUpdateService],
})
export class OHLCModule {}
