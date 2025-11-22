import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type DailyAggregateDocument = DailyAggregate & Document;

/**
 * Daily Aggregate Schema
 *
 * This schema stores daily aggregated price data for long-term historical analysis.
 * Instead of keeping millions of snapshots, we aggregate daily summaries:
 * - Open: First price of the day
 * - High: Highest price of the day
 * - Low: Lowest price of the day
 * - Close: Last price of the day
 * - Volume: Trading volume (if available)
 *
 * This data is kept permanently and provides efficient access to long-term trends.
 * A cron job should aggregate hourly snapshots into daily summaries.
 *
 * Storage estimate: ~365 records/year per item = manageable long-term growth
 */
@Schema({
  collection: "daily_aggregates",
  timestamps: true,
})
export class DailyAggregate {
  /**
   * Item type (currency, crypto, gold)
   */
  @Prop({ required: true, index: true })
  itemType!: string;

  /**
   * Item code (e.g., 'usd_sell', 'btc', 'sekkeh')
   */
  @Prop({ required: true, index: true })
  itemCode!: string;

  /**
   * Date (day only, no time component)
   * Format: YYYY-MM-DD
   */
  @Prop({ required: true, index: true })
  date!: Date;

  /**
   * Opening price (first price of the day)
   */
  @Prop({ required: true })
  open!: number;

  /**
   * Highest price of the day
   */
  @Prop({ required: true })
  high!: number;

  /**
   * Lowest price of the day
   */
  @Prop({ required: true })
  low!: number;

  /**
   * Closing price (last price of the day)
   */
  @Prop({ required: true })
  close!: number;

  /**
   * Trading volume (optional, may not be available for all items)
   */
  @Prop({ default: 0 })
  volume!: number;

  /**
   * Number of snapshots aggregated to create this daily summary
   */
  @Prop({ required: true })
  snapshotCount!: number;

  /**
   * Average price across all snapshots
   */
  @Prop({ required: true })
  average!: number;
}

export const DailyAggregateSchema =
  SchemaFactory.createForClass(DailyAggregate);

// Compound unique index to prevent duplicate daily records
DailyAggregateSchema.index(
  { itemType: 1, itemCode: 1, date: 1 },
  { unique: true },
);

// Index for efficient time-series queries
DailyAggregateSchema.index({ itemCode: 1, date: -1 });
DailyAggregateSchema.index({ date: -1 });

// Note: No TTL index - daily aggregates are kept permanently for historical analysis
