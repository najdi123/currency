import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NavasanController } from './navasan.controller';
import { NavasanService } from './navasan.service';
import { Cache, CacheSchema } from './schemas/cache.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cache.name, schema: CacheSchema }]),
  ],
  controllers: [NavasanController],
  providers: [NavasanService],
  exports: [NavasanService],
})
export class NavasanModule {}
