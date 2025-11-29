import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type UpdateLogDocument = UpdateLog & Document;

@Schema({
  timestamps: true,
  collection: "ohlc_update_logs",
})
export class UpdateLog {
  @Prop({ required: true, index: true })
  itemCode!: string;

  @Prop({ required: true })
  itemType!: string;

  @Prop({ required: true })
  timeframe!: string;

  @Prop({ required: true })
  startDate!: Date;

  @Prop({ required: true })
  endDate!: Date;

  @Prop({
    required: true,
    enum: ["backfill", "realtime", "correction", "aggregation"],
  })
  updateType!: string;

  @Prop({ required: true, default: 0 })
  recordsAffected!: number;

  @Prop({ required: true, default: Date.now })
  timestamp!: Date;

  @Prop({
    required: true,
    enum: ["success", "partial", "failed"],
    default: "success",
  })
  status!: string;

  @Prop({ default: null })
  errorDetails!: string;

  @Prop({ default: 0 })
  duration!: number; // in milliseconds

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, any>;
}

export const UpdateLogSchema = SchemaFactory.createForClass(UpdateLog);

// Create indexes for efficient querying
UpdateLogSchema.index({ itemCode: 1, timestamp: -1 });
UpdateLogSchema.index({ updateType: 1, status: 1 });
UpdateLogSchema.index({ timestamp: -1 });
UpdateLogSchema.index({ itemCode: 1, timeframe: 1, timestamp: -1 });
