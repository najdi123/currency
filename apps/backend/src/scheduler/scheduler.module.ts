import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { MongooseModule } from "@nestjs/mongoose";
import { OhlcAggregationScheduler } from "./ohlc-aggregation.scheduler";
import { DataRetentionScheduler } from "./data-retention.scheduler";
import { OhlcCleanupSchedulerService } from "./ohlc-cleanup-scheduler.service";
import {
  HistoricalOhlc,
  HistoricalOhlcSchema,
} from "../schemas/historical-ohlc.schema";
import {
  PriceSnapshot,
  PriceSnapshotSchema,
} from "../navasan/schemas/price-snapshot.schema";
import {
  OhlcSnapshot,
  OhlcSnapshotSchema,
} from "../navasan/schemas/ohlc-snapshot.schema";
import {
  OHLCPermanent,
  OHLCPermanentSchema,
} from "../navasan/schemas/ohlc-permanent.schema";

/**
 * Scheduler Module
 *
 * Manages all scheduled tasks for the application:
 * - OHLC data aggregation (weekly, monthly) - daily is disabled
 * - Data retention and cleanup
 * - OHLC snapshot cleanup (removes old snapshots based on retention policies)
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
  ],
  providers: [
    OhlcAggregationScheduler,
    DataRetentionScheduler,
    OhlcCleanupSchedulerService,
  ],
  exports: [
    OhlcAggregationScheduler,
    DataRetentionScheduler,
    OhlcCleanupSchedulerService,
  ],
})
export class SchedulerModule {}
