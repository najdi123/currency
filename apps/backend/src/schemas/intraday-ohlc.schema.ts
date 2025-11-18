import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IntradayOhlcDocument = IntradayOhlc & Document;

@Schema({ collection: 'intraday_ohlc', timestamps: true })
export class IntradayOhlc {
  @Prop({ required: true })
  itemCode: string; // References TrackedItem.code

  @Prop({ required: true, type: Date })
  date: Date; // Start of day (midnight UTC or local)

  @Prop({ type: Number })
  open?: number;

  @Prop({ type: Number })
  high?: number;

  @Prop({ type: Number })
  low?: number;

  @Prop({ type: Number })
  close?: number;

  @Prop({ type: Number, default: 0 })
  updateCount: number; // Number of price updates today

  @Prop({ type: Date })
  lastUpdate?: Date;

  @Prop({ type: Date })
  expiresAt: Date; // TTL index - auto-delete 48h after date
}

export const IntradayOhlcSchema = SchemaFactory.createForClass(IntradayOhlc);

// Compound index for querying
IntradayOhlcSchema.index({ itemCode: 1, date: -1 });

// TTL index - MongoDB will auto-delete documents after expiresAt
IntradayOhlcSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
