import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GoldService } from './gold.service';
import { GoldController } from './gold.controller';
import { Gold, GoldSchema } from './schemas/gold.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Gold.name, schema: GoldSchema },
    ]),
  ],
  controllers: [GoldController],
  providers: [GoldService],
  exports: [GoldService],
})
export class GoldModule {}
