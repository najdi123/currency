import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DigitalCurrencyDocument = DigitalCurrency & Document;

@Schema({ timestamps: true })
export class DigitalCurrency {
  @Prop({ required: true, unique: true })
  symbol!: string; // e.g., BTC, ETH, USDT

  @Prop({ required: true })
  name!: string; // e.g., Bitcoin, Ethereum

  @Prop({ required: true, type: Number })
  priceInToman!: number; // Price in Iranian Toman

  @Prop({ type: Number })
  marketCapInToman?: number; // Market cap in Toman

  @Prop({ type: Number })
  volumeInToman24h?: number; // 24-hour trading volume in Toman

  @Prop({ type: Number, default: 0 })
  changePercentage24h!: number; // 24-hour price change percentage

  @Prop({ type: Number, default: 0 })
  changeAmount24h!: number; // 24-hour price change in Toman

  @Prop({ type: Number, default: 0 })
  changePercentage7d!: number; // 7-day price change percentage

  @Prop({ type: Number })
  circulatingSupply?: number; // Circulating supply

  @Prop({ type: Number })
  totalSupply?: number; // Total supply

  @Prop({ type: Number })
  maxSupply?: number; // Maximum supply

  @Prop()
  lastUpdated?: Date; // Last price update timestamp

  @Prop({ default: true })
  isActive!: boolean; // Whether the currency is actively tracked
}

export const DigitalCurrencySchema = SchemaFactory.createForClass(DigitalCurrency);

// Add indexes for better query performance
// Note: 'symbol' field already has an index due to unique: true
DigitalCurrencySchema.index({ isActive: 1 });
DigitalCurrencySchema.index({ lastUpdated: -1 });
DigitalCurrencySchema.index({ marketCapInToman: -1 }); // For top cryptocurrencies query
