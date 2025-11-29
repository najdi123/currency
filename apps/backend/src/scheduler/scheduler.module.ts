import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { MongooseModule } from "@nestjs/mongoose";
import { OhlcAggregationScheduler } from "./ohlc-aggregation.scheduler";
import { DataRetentionScheduler } from "./data-retention.scheduler";
import { OhlcCleanupSchedulerService } from "./ohlc-cleanup-scheduler.service";
import { OhlcPermanentCleanupScheduler } from "./ohlc-permanent-cleanup.scheduler";
import { NavasanSchedulerService } from "./navasan-scheduler.service";
import { ScheduleConfigService } from "./schedule-config.service";
import { SchedulerController } from "./scheduler.controller";
import {
  HistoricalOhlc,
  HistoricalOhlcSchema,
} from "../schemas/historical-ohlc.schema";
import {
  PriceSnapshot,
  PriceSnapshotSchema,
} from "../market-data/schemas/price-snapshot.schema";
import {
  OhlcSnapshot,
  OhlcSnapshotSchema,
} from "../market-data/schemas/ohlc-snapshot.schema";
import {
  OHLCPermanent,
  OHLCPermanentSchema,
} from "../market-data/schemas/ohlc-permanent.schema";
import { MarketDataModule } from "../market-data/market-data.module";
import { AuthModule } from "../auth/auth.module";

/**
 * Scheduler Module
 *
 * Manages all scheduled tasks for the application:
 * - OHLC data aggregation (weekly, monthly) - daily is disabled
 * - Data retention and cleanup for historical_ohlc, price_snapshots, ohlc_snapshots
 * - OHLC snapshot cleanup (removes old snapshots based on retention policies)
 * - OHLC permanent cleanup (removes old 1m/5m/15m/1h data to control RAM usage)
 *
 * Note: OHLCPermanent is the primary data source.
 * Daily aggregation is disabled since ohlc_permanent already has 1d data.
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: HistoricalOhlc.name, schema: HistoricalOhlcSchema },
      { name: PriceSnapshot.name, schema: PriceSnapshotSchema },
      { name: OhlcSnapshot.name, schema: OhlcSnapshotSchema },
      { name: OHLCPermanent.name, schema: OHLCPermanentSchema },
    ]),
    MarketDataModule, // For MarketDataOrchestratorService
    AuthModule, // For JwtAuthGuard in SchedulerController
  ],
  controllers: [SchedulerController],
  providers: [
    OhlcAggregationScheduler,
    DataRetentionScheduler,
    OhlcCleanupSchedulerService,
    OhlcPermanentCleanupScheduler,
    NavasanSchedulerService,
    ScheduleConfigService,
  ],
  exports: [
    OhlcAggregationScheduler,
    DataRetentionScheduler,
    OhlcCleanupSchedulerService,
    OhlcPermanentCleanupScheduler,
    NavasanSchedulerService,
  ],
})
export class SchedulerModule {}
