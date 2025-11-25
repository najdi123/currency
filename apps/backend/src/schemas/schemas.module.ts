import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { TrackedItem, TrackedItemSchema } from "./tracked-item.schema";
import { CurrentPrice, CurrentPriceSchema } from "./current-price.schema";
import { HistoricalOhlc, HistoricalOhlcSchema } from "./historical-ohlc.schema";
import { UserRateLimit, UserRateLimitSchema } from "./user-rate-limit.schema";

/**
 * Schemas Module
 *
 * Registers simplified schemas with Mongoose.
 *
 * Note: IntradayOhlc has been removed - all OHLC data now uses
 * OHLCPermanent from navasan/schemas as the single source of truth.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrackedItem.name, schema: TrackedItemSchema },
      { name: CurrentPrice.name, schema: CurrentPriceSchema },
      { name: HistoricalOhlc.name, schema: HistoricalOhlcSchema },
      { name: UserRateLimit.name, schema: UserRateLimitSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class SchemasModule {}
