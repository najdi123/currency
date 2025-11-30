import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type OHLCPermanentDocument = OHLCPermanent & Document;

@Schema({
  timestamps: true,
  collection: "ohlc_permanent",
})
export class OHLCPermanent {
  @Prop({ required: true, index: true })
  itemCode!: string;

  @Prop({ required: true, enum: ["currency", "crypto", "gold"] })
  itemType!: string;

  @Prop({ required: true, index: true })
  timestamp!: Date;

  @Prop({ required: true, enum: ["1m", "5m", "15m", "1h", "1d", "1w", "1M"] })
  timeframe!: string;

  @Prop({ required: true })
  open!: number;

  @Prop({ required: true })
  high!: number;

  @Prop({ required: true })
  low!: number;

  @Prop({ required: true })
  close!: number;

  @Prop({ default: null })
  volume!: number;

  @Prop({ required: true, enum: ["api", "calculated", "interpolated"] })
  source!: string;

  @Prop({ default: Date.now })
  lastUpdated!: Date;

  @Prop({ default: 0 })
  updateCount!: number;

  @Prop({ default: true })
  isComplete!: boolean;

  @Prop({ default: false })
  hasMissingData!: boolean;
}

export const OHLCPermanentSchema = SchemaFactory.createForClass(OHLCPermanent);

// Create compound unique index
OHLCPermanentSchema.index(
  { itemCode: 1, itemType: 1, timeframe: 1, timestamp: 1 },
  { unique: true },
);

// Additional performance indexes
OHLCPermanentSchema.index({ itemCode: 1, timestamp: 1 });
OHLCPermanentSchema.index({ lastUpdated: 1 });
OHLCPermanentSchema.index({ itemCode: 1, timeframe: 1, timestamp: -1 });

// TTL index for automatic cleanup of fine-grained timeframes (1m, 5m)
// Keeps minute data for 7 days, 5-minute data for 14 days
// Note: MongoDB TTL indexes only work on date fields at the document level
// For conditional TTL based on timeframe, we use a separate expiresAt field approach
// or handle cleanup via scheduled task. Here we add a partial index for efficient cleanup queries.
OHLCPermanentSchema.index(
  { timeframe: 1, timestamp: 1 },
  {
    name: 'ttl_cleanup_helper',
    partialFilterExpression: { timeframe: { $in: ['1m', '5m'] } }
  }
);
