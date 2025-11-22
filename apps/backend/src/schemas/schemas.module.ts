import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { TrackedItem, TrackedItemSchema } from "./tracked-item.schema";
import { CurrentPrice, CurrentPriceSchema } from "./current-price.schema";
import { IntradayOhlc, IntradayOhlcSchema } from "./intraday-ohlc.schema";
import { HistoricalOhlc, HistoricalOhlcSchema } from "./historical-ohlc.schema";
import { UserRateLimit, UserRateLimitSchema } from "./user-rate-limit.schema";

/**
 * Schemas Module
 *
 * Registers all new simplified schemas with Mongoose.
 * Replaces the old complex 7-collection structure with 5 clean collections.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrackedItem.name, schema: TrackedItemSchema },
      { name: CurrentPrice.name, schema: CurrentPriceSchema },
      { name: IntradayOhlc.name, schema: IntradayOhlcSchema },
      { name: HistoricalOhlc.name, schema: HistoricalOhlcSchema },
      { name: UserRateLimit.name, schema: UserRateLimitSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class SchemasModule {}
