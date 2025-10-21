import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GoldDocument = Gold & Document;

@Schema({ timestamps: true })
export class Gold {
  @Prop({ required: true, unique: true })
  type!: string; // e.g., '24K', '18K', 'Coin', 'Bar'

  @Prop({ required: true })
  name!: string; // e.g., '24 Karat Gold', 'Gold Coin (Bahar Azadi)'

  @Prop({ required: true, type: Number })
  priceInToman!: number; // Price per gram or unit in Iranian Toman

  @Prop({ required: true })
  unit!: string; // e.g., 'gram', 'piece', 'ounce'

  @Prop({ type: Number })
  weight?: number; // Weight in grams (if applicable)

  @Prop({ type: Number, default: 0 })
  changePercentage24h!: number; // 24-hour price change percentage

  @Prop({ type: Number, default: 0 })
  changeAmount24h!: number; // 24-hour price change in Toman

  @Prop({ type: Number, default: 0 })
  changePercentage7d!: number; // 7-day price change percentage

  @Prop({ type: Number })
  purity?: number; // Gold purity percentage (e.g., 99.9 for 24K)

  @Prop()
  description?: string; // Additional details about the gold type

  @Prop()
  lastUpdated?: Date; // Last price update timestamp

  @Prop({ default: true })
  isActive!: boolean; // Whether the gold type is actively tracked
}

export const GoldSchema = SchemaFactory.createForClass(Gold);

// Add indexes for better query performance
// Note: 'type' field already has an index due to unique: true
GoldSchema.index({ isActive: 1 });
GoldSchema.index({ lastUpdated: -1 });
GoldSchema.index({ purity: -1 }); // For purity-based queries
