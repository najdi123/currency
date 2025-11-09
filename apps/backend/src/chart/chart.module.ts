import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ChartController } from './chart.controller';
import { ChartService } from './chart.service';
import { Cache, CacheSchema } from '../navasan/schemas/cache.schema';
import { OhlcSnapshot, OhlcSnapshotSchema } from '../navasan/schemas/ohlc-snapshot.schema';
import { PriceSnapshot, PriceSnapshotSchema } from '../navasan/schemas/price-snapshot.schema';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Cache.name, schema: CacheSchema },
      { name: OhlcSnapshot.name, schema: OhlcSnapshotSchema },
      { name: PriceSnapshot.name, schema: PriceSnapshotSchema },
    ]),
    MetricsModule,
  ],
  controllers: [ChartController],
  providers: [ChartService],
  exports: [ChartService],
})
export class ChartModule {}
