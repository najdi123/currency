import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type HistoricalOhlcDocument = HistoricalOhlc & Document;

export enum OhlcTimeframe {
  HOURLY = "hourly",
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
}

@Schema({ collection: "historical_ohlc", timestamps: true })
export class HistoricalOhlc {
  @Prop({ required: true })
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

// Compound indexes for efficient queries
HistoricalOhlcSchema.index({ itemCode: 1, timeframe: 1, periodStart: -1 });
HistoricalOhlcSchema.index({ itemCode: 1, periodStart: -1 });

// TTL index for automatic cleanup (optional, based on retention policy)
HistoricalOhlcSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
