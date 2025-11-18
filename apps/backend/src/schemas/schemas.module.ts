import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrackedItem, TrackedItemSchema } from './tracked-item.schema';
import { CurrentPrice, CurrentPriceSchema } from './current-price.schema';
import { IntradayOhlc, IntradayOhlcSchema } from './intraday-ohlc.schema';
import { HistoricalOhlc, HistoricalOhlcSchema } from './historical-ohlc.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrackedItem.name, schema: TrackedItemSchema },
      { name: CurrentPrice.name, schema: CurrentPriceSchema },
      { name: IntradayOhlc.name, schema: IntradayOhlcSchema },
      { name: HistoricalOhlc.name, schema: HistoricalOhlcSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class SchemasModule {}
