import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OhlcSnapshotDocument = OhlcSnapshot & Document;

/**
 * OHLC Snapshot Schema with TTL
 *
 * This schema stores historical records of OHLC (chart) data with automatic cleanup.
 * Records are automatically deleted after 90 days to prevent unbounded growth.
 * For long-term historical data, use daily aggregates instead.
 *
 * Each snapshot represents chart data for a specific item and time range.
 *
 * TTL: 90 days (7,776,000 seconds)
 */
@Schema({
  collection: 'ohlc_snapshots',
  timestamps: true,
})
export class OhlcSnapshot {
  /**
   * Item code (e.g., 'usd_sell', 'btc', 'sekkeh')
   */
  @Prop({ required: true, index: true })
  itemCode!: string;

  /**
   * Time range (e.g., '1d', '1w', '1m', '3m', '1y', 'all')
   */
  @Prop({ required: true, index: true })
  timeRange!: string;

  /**
   * The OHLC data points
   * Array of { timestamp, date, open, high, low, close }
   */
  @Prop({ type: Array, required: true })
  data!: unknown[];

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
   */
  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const OhlcSnapshotSchema = SchemaFactory.createForClass(OhlcSnapshot);

// TTL index - MongoDB will automatically delete documents after 90 days
// 90 days = 7,776,000 seconds
OhlcSnapshotSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

// Add compound indexes for efficient querying
OhlcSnapshotSchema.index({ itemCode: 1, timeRange: 1, timestamp: -1 });
OhlcSnapshotSchema.index({ itemCode: 1, timestamp: -1 });
OhlcSnapshotSchema.index({ timestamp: -1 });
