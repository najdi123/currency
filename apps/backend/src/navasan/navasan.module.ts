import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NavasanController } from './navasan.controller';
import { NavasanService } from './navasan.service';
import { Cache, CacheSchema } from './schemas/cache.schema';
import { PriceSnapshot, PriceSnapshotSchema } from './schemas/price-snapshot.schema';
import { OhlcSnapshot, OhlcSnapshotSchema } from './schemas/ohlc-snapshot.schema';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cache.name, schema: CacheSchema },
      { name: PriceSnapshot.name, schema: PriceSnapshotSchema },
      { name: OhlcSnapshot.name, schema: OhlcSnapshotSchema },
    ]),
    MetricsModule,
  ],
  controllers: [NavasanController],
  providers: [NavasanService],
  exports: [NavasanService],
})
export class NavasanModule {}
