import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { MarketDataResponse, OhlcData } from "../types/market-data.types";

export type CacheDocument = Cache & Document;

/**
 * Discriminated union type for cache data
 * This provides type safety based on what kind of data is cached
 */
export type CacheData = MarketDataResponse | OhlcData[];

@Schema({ timestamps: true })
export class Cache {
  @Prop({ required: true, index: true })
  category!: string; // e.g., 'currencies', 'crypto', 'gold', 'all', or 'ohlc_<itemCode>_<timeRange>'

  @Prop({ required: true, type: Object })
  data!: CacheData; // Cached API response data - properly typed

  @Prop({ required: true })
  timestamp!: Date; // When the data was cached

  @Prop({ required: true })
  expiresAt!: Date; // Auto-cleanup: when this cache entry should expire

  // Cache tier - 'fresh' for recent data, 'stale' for fallback data
  @Prop({
    required: true,
    enum: ["fresh", "stale", "archived"],
    default: "fresh",
  })
  cacheType!: "fresh" | "stale" | "archived";

  // Track if this data was served as a fallback
  @Prop({ default: false })
  isFallback!: boolean;

  // Last successful API fetch timestamp
  @Prop()
  lastApiSuccess?: Date;

  // Last API error message
  @Prop()
  lastApiError?: string;

  // Consecutive API error count
  @Prop({ default: 0 })
  apiErrorCount!: number;

  // API metadata for rate limiting, etc.
  @Prop({ type: Object })
  apiMetadata?: {
    statusCode?: number;
    rateLimitRemaining?: number;
    rateLimitReset?: Date;
  };
}

export const CacheSchema = SchemaFactory.createForClass(Cache);

// TTL index for automatic cleanup of expired cache entries
// MongoDB will automatically delete documents when expiresAt is reached
CacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// UNIQUE constraint: Only one cache entry per category+cacheType
// Prevents multiple "fresh" or "stale" entries for the same category
CacheSchema.index(
  { category: 1, cacheType: 1 },
  { unique: true, name: "unique_category_cachetype" },
);

// Index for efficient queries by cache type
CacheSchema.index({ category: 1, cacheType: 1, timestamp: -1 });
