import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HistoricalOhlc, HistoricalOhlcSchema } from "./historical-ohlc.schema";

/**
 * Schemas Module
 *
 * Registers shared schemas with Mongoose.
 *
 * Notes:
 * - OHLCPermanent from market-data/schemas is the single source of truth for price data
 * - HistoricalOhlc is used for weekly/monthly aggregation and chart fallbacks
 * - ManagedItem from schemas/managed-item.schema is the admin layer
 * - UserRateLimit is registered in RateLimitModule (encapsulated)
 *
 * Removed schemas (Phase 9 cleanup):
 * - TrackedItem: Replaced by ManagedItem
 * - CurrentPrice: Replaced by OHLCPermanent
 * - IntradayOhlc: Replaced by OHLCPermanent
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HistoricalOhlc.name, schema: HistoricalOhlcSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class SchemasModule {}
