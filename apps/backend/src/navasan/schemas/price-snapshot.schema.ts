import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PriceSnapshotDocument = PriceSnapshot & Document;

/**
 * Price Snapshot Schema - PERMANENT STORAGE
 *
 * This schema stores historical records of price data permanently.
 * Records are NEVER automatically deleted - they remain forever for historical analysis.
 *
 * Each snapshot represents the state of all items at a specific timestamp.
 * One snapshot is saved per hour per category (currencies, crypto, gold).
 *
 * Storage estimate: ~10-20 MB per month
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

// PERMANENT STORAGE: No TTL index - records are kept forever
// If you want to enable automatic deletion after X days, uncomment the line below:
// PriceSnapshotSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

// Add compound indexes for efficient querying
PriceSnapshotSchema.index({ category: 1, timestamp: -1 });
PriceSnapshotSchema.index({ timestamp: -1 });
