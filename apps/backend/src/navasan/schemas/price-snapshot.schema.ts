import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PriceSnapshotDocument = PriceSnapshot & Document;

/**
 * Price Snapshot Schema with TTL
 *
 * This schema stores historical records of price data with automatic cleanup.
 * Records are automatically deleted after 90 days to prevent unbounded growth.
 * For long-term historical data, use daily aggregates instead.
 *
 * Each snapshot represents the state of all items at a specific timestamp.
 *
 * TTL: 90 days (7,776,000 seconds)
 */
@Schema({
  collection: 'price_snapshots',
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
  @Prop({ default: 'api' })
  source!: string;

  /**
   * Optional metadata about the API call
   * (rate limits, response time, etc.)
   */
  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const PriceSnapshotSchema = SchemaFactory.createForClass(PriceSnapshot);

// TTL index - MongoDB will automatically delete documents after 90 days
// 90 days = 7,776,000 seconds
PriceSnapshotSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

// Add compound indexes for efficient querying
PriceSnapshotSchema.index({ category: 1, timestamp: -1 });
PriceSnapshotSchema.index({ timestamp: -1 });
