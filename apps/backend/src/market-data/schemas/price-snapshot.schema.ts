import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type PriceSnapshotDocument = PriceSnapshot & Document;

/**
 * Price Snapshot Schema - FALLBACK DATA SOURCE
 *
 * This schema stores hourly price snapshots as a fallback when OHLC data is unavailable.
 * Records are automatically deleted after 90 days via the DataRetentionScheduler.
 *
 * Each snapshot represents the state of all items at a specific timestamp.
 * One snapshot is saved per hour per category (currencies, crypto, gold).
 *
 * Primary use: Emergency fallback when ohlc_permanent has data gaps.
 * Retention: 90 days
 * Storage estimate: ~10-20 MB per month
 */
@Schema({
  collection: "price_snapshots",
  timestamps: true,
})
export class PriceSnapshot {
  /**
   * Category of data (currencies, crypto, gold)
   */
  @Prop({ required: true, index: true })
  category!: string;

  /**
   * The actual price data snapshot
   * This stores the complete API response at this point in time
   */
  @Prop({ type: Object, required: true })
  data!: Record<string, unknown>;

  /**
   * Timestamp when this snapshot was captured
   */
  @Prop({ required: true, index: true })
  timestamp!: Date;

  /**
   * Source of the data (api, manual, etc.)
   */
  @Prop({ default: "api" })
  source!: string;

  /**
   * Optional metadata about the API call
   * (rate limits, response time, etc.)
   */
  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const PriceSnapshotSchema = SchemaFactory.createForClass(PriceSnapshot);

// Retention: Records deleted after 90 days by DataRetentionScheduler
// No TTL index - cleanup is handled by scheduled cron job for better control

// UNIQUE constraint: Prevent duplicate snapshots for same category+timestamp
PriceSnapshotSchema.index(
  { category: 1, timestamp: 1 },
  { unique: true, name: "unique_category_timestamp" },
);

// Add compound indexes for efficient querying
PriceSnapshotSchema.index({ category: 1, timestamp: -1 });
PriceSnapshotSchema.index({ timestamp: -1 });
