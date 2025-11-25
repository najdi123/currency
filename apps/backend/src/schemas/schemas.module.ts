import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { TrackedItem, TrackedItemSchema } from "./tracked-item.schema";
import { CurrentPrice, CurrentPriceSchema } from "./current-price.schema";
import { HistoricalOhlc, HistoricalOhlcSchema } from "./historical-ohlc.schema";

/**
 * Schemas Module
 *
 * Registers simplified schemas with Mongoose.
 *
 * Note: IntradayOhlc has been removed - all OHLC data now uses
 * OHLCPermanent from navasan/schemas as the single source of truth.
 *
 * Note: UserRateLimit is registered in RateLimitModule, not here,
 * to keep rate limiting concerns properly encapsulated.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrackedItem.name, schema: TrackedItemSchema },
      { name: CurrentPrice.name, schema: CurrentPriceSchema },
      { name: HistoricalOhlc.name, schema: HistoricalOhlcSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class SchemasModule {}
