import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ChartController } from './chart.controller';
import { ChartService } from './chart.service';
import { Cache, CacheSchema } from '../navasan/schemas/cache.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Cache.name, schema: CacheSchema }]),
  ],
  controllers: [ChartController],
  providers: [ChartService],
  exports: [ChartService],
})
export class ChartModule {}
