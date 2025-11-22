import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { MongooseModule } from "@nestjs/mongoose";
import { OhlcAggregationScheduler } from "./ohlc-aggregation.scheduler";
import { DataRetentionScheduler } from "./data-retention.scheduler";
import {
  IntradayOhlc,
  IntradayOhlcSchema,
} from "../schemas/intraday-ohlc.schema";
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

/**
 * Scheduler Module
 *
 * Manages all scheduled tasks for the application:
 * - OHLC data aggregation (daily, weekly, monthly)
 * - Data retention and cleanup
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: IntradayOhlc.name, schema: IntradayOhlcSchema },
      { name: HistoricalOhlc.name, schema: HistoricalOhlcSchema },
      { name: PriceSnapshot.name, schema: PriceSnapshotSchema },
      { name: OhlcSnapshot.name, schema: OhlcSnapshotSchema },
    ]),
  ],
  providers: [OhlcAggregationScheduler, DataRetentionScheduler],
  exports: [OhlcAggregationScheduler, DataRetentionScheduler],
})
export class SchedulerModule {}
