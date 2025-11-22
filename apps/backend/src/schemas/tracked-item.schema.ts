import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type TrackedItemDocument = TrackedItem & Document;

@Schema({ collection: "tracked_items", timestamps: true })
export class TrackedItem {
  @Prop({ required: true })
  code: string; // e.g., 'usd_sell', 'btc', 'gold_18k'

  @Prop({ required: true, enum: ["currency", "crypto", "gold", "coin"] })
  type: string;

  @Prop({ required: true })
  name: string; // e.g., 'US Dollar (Sell)', 'Bitcoin'

  @Prop({ type: Object })
  metadata: {
    symbol?: string; // e.g., '$', '₿'
    decimalPlaces?: number;
    displayOrder?: number;
    category?: string;
  };

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date })
  lastPriceUpdate?: Date;
}

export const TrackedItemSchema = SchemaFactory.createForClass(TrackedItem);

// Indexes
TrackedItemSchema.index({ type: 1, isActive: 1 });
TrackedItemSchema.index({ code: 1 }, { unique: true });
