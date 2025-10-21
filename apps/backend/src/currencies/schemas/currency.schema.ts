import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CurrencyDocument = Currency & Document;

@Schema({ timestamps: true })
export class Currency {
  @Prop({ required: true, unique: true })
  code!: string; // e.g., USD, EUR, GBP

  @Prop({ required: true })
  name!: string; // e.g., US Dollar, Euro

  @Prop({ required: true })
  symbol!: string; // e.g., $, €, £

  @Prop({ required: true, type: Number })
  priceInToman!: number; // Price in Iranian Toman

  @Prop({ type: Number, default: 0 })
  changePercentage24h!: number; // 24-hour price change percentage

  @Prop({ type: Number, default: 0 })
  changeAmount24h!: number; // 24-hour price change in Toman

  @Prop()
  lastUpdated?: Date; // Last price update timestamp

  @Prop({ default: true })
  isActive!: boolean; // Whether the currency is actively tracked
}

export const CurrencySchema = SchemaFactory.createForClass(Currency);

// Add indexes for better query performance
// Note: 'code' field already has an index due to unique: true
CurrencySchema.index({ isActive: 1 });
CurrencySchema.index({ lastUpdated: -1 });
