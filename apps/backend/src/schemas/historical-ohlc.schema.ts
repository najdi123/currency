import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type HistoricalOhlcDocument = HistoricalOhlc & Document;

/**
 * OHLC Timeframe enum for aggregated historical data
 * Note: HOURLY and DAILY timeframes are not used - ohlc_permanent is the source for granular data
 * historical_ohlc only stores WEEKLY and MONTHLY aggregations
 */
export enum OhlcTimeframe {
  WEEKLY = "weekly",
  MONTHLY = "monthly",
}

@Schema({ collection: "historical_ohlc", timestamps: true })
export class HistoricalOhlc {
  // itemCode is stored in UPPERCASE for consistency across all collections
  // Use uppercase: true to automatically normalize on save
  @Prop({ required: true, uppercase: true })
  itemCode: string; // References TrackedItem.code

  @Prop({ required: true, enum: Object.values(OhlcTimeframe) })
  timeframe: OhlcTimeframe;

  @Prop({ required: true, type: Date })
  periodStart: Date; // Start of hour/day/week/month

  @Prop({ required: true, type: Date })
  periodEnd: Date; // End of period

  @Prop({ required: true, type: Number })
  open: number;

  @Prop({ required: true, type: Number })
  high: number;

  @Prop({ required: true, type: Number })
  low: number;

  @Prop({ required: true, type: Number })
  close: number;

  @Prop({ type: Number, default: 0 })
  dataPoints: number; // Number of updates aggregated

  @Prop({ type: Date })
  expiresAt?: Date; // Optional TTL for cleanup policies
}

export const HistoricalOhlcSchema =
  SchemaFactory.createForClass(HistoricalOhlc);

// Unique constraint to prevent duplicate OHLC records for same item/timeframe/period
HistoricalOhlcSchema.index(
  { itemCode: 1, timeframe: 1, periodStart: 1 },
  { unique: true, name: 'unique_ohlc_record' }
);

// Compound indexes for efficient queries
HistoricalOhlcSchema.index({ itemCode: 1, timeframe: 1, periodStart: -1 });
HistoricalOhlcSchema.index({ itemCode: 1, periodStart: -1 });

// TTL index for automatic cleanup (optional, based on retention policy)
HistoricalOhlcSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
