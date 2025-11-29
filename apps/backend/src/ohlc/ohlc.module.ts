import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { MongooseModule } from "@nestjs/mongoose";
import { MarketDataModule } from "../market-data/market-data.module";
import { ChartModule } from "../chart/chart.module";
import { OHLCManagerService } from "./ohlc-manager.service";
import { OHLCCollectorService } from "./ohlc-collector.service";
import { OHLCUpdateService } from "./ohlc-update.service";
import { OHLCController } from "./ohlc.controller";
import {
  OHLCPermanent,
  OHLCPermanentSchema,
} from "../market-data/schemas/ohlc-permanent.schema";
import {
  UpdateLog,
  UpdateLogSchema,
} from "../market-data/schemas/update-log.schema";

@Module({
  imports: [
    ScheduleModule.forRoot(), // Required for @Cron decorators in OHLCCollectorService
    MongooseModule.forFeature([
      { name: OHLCPermanent.name, schema: OHLCPermanentSchema },
      { name: UpdateLog.name, schema: UpdateLogSchema },
    ]),
    MarketDataModule, // For MarketDataOrchestratorService
    ChartModule, // For ChartService
  ],
  controllers: [OHLCController],
  providers: [OHLCManagerService, OHLCCollectorService, OHLCUpdateService],
  exports: [OHLCManagerService, OHLCCollectorService, OHLCUpdateService],
})
export class OHLCModule {}
