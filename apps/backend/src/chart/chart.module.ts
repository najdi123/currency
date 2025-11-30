import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule } from "@nestjs/config";
import { ChartController } from "./chart.controller";
import { ChartService } from "./chart.service";
import { Cache, CacheSchema } from "../market-data/schemas/cache.schema";
import {
  PriceSnapshot,
  PriceSnapshotSchema,
} from "../market-data/schemas/price-snapshot.schema";
import {
  HistoricalOhlc,
  HistoricalOhlcSchema,
} from "../schemas/historical-ohlc.schema";
import {
  OHLCPermanent,
  OHLCPermanentSchema,
} from "../market-data/schemas/ohlc-permanent.schema";
import { MetricsModule } from "../metrics/metrics.module";

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Cache.name, schema: CacheSchema },
      { name: PriceSnapshot.name, schema: PriceSnapshotSchema },
      { name: HistoricalOhlc.name, schema: HistoricalOhlcSchema },
      { name: OHLCPermanent.name, schema: OHLCPermanentSchema },
    ]),
    MetricsModule,
  ],
  controllers: [ChartController],
  providers: [ChartService],
  exports: [ChartService],
})
export class ChartModule {}
