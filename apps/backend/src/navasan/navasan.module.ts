import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NavasanController } from './navasan.controller';
import { NavasanService } from './navasan.service';
import { Cache, CacheSchema } from './schemas/cache.schema';
import { PriceSnapshot, PriceSnapshotSchema } from './schemas/price-snapshot.schema';
import { OhlcSnapshot, OhlcSnapshotSchema } from './schemas/ohlc-snapshot.schema';
import { OHLCPermanent, OHLCPermanentSchema } from './schemas/ohlc-permanent.schema';
import { AggregationRule, AggregationRuleSchema } from './schemas/aggregation-rule.schema';
import { UpdateLog, UpdateLogSchema } from './schemas/update-log.schema';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cache.name, schema: CacheSchema },
      { name: PriceSnapshot.name, schema: PriceSnapshotSchema },
      { name: OhlcSnapshot.name, schema: OhlcSnapshotSchema },
      { name: OHLCPermanent.name, schema: OHLCPermanentSchema },
      { name: AggregationRule.name, schema: AggregationRuleSchema },
      { name: UpdateLog.name, schema: UpdateLogSchema },
    ]),
    MetricsModule,
  ],
  controllers: [NavasanController],
  providers: [NavasanService],
  exports: [
    NavasanService,
    MongooseModule, // Export MongooseModule to make the models available to other modules
  ],
})
export class NavasanModule {}
