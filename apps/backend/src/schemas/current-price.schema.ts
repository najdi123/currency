import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type CurrentPriceDocument = CurrentPrice & Document;

@Schema({ collection: "current_prices", timestamps: true })
export class CurrentPrice {
  @Prop({ required: true })
  itemCode: string; // References TrackedItem.code

  @Prop({ required: true, type: Number })
  price: number;

  @Prop({ type: Number, default: 0 })
  change: number; // Percentage change

  @Prop({ type: Number })
  previousPrice?: number;

  @Prop({ required: true, type: Date })
  priceTimestamp: Date; // When this price was recorded

  @Prop({ type: String })
  source: string; // 'persianapi', 'navasan', etc.

  @Prop({ type: Object })
  rawData?: Record<string, any>; // Store original API response for debugging
}

export const CurrentPriceSchema = SchemaFactory.createForClass(CurrentPrice);

// Indexes
CurrentPriceSchema.index({ itemCode: 1 }, { unique: true });
CurrentPriceSchema.index({ priceTimestamp: -1 });
CurrentPriceSchema.index({ updatedAt: -1 });
