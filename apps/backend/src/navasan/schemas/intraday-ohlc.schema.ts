import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IntradayOhlcDocument = IntradayOhlc & Document;

/**
 * Intraday Data Point
 * Represents a single price snapshot at a specific time during the day
 */
export interface DataPoint {
  time: string; // HH:mm format (e.g., '08:00', '08:10')
  price: number;
}

/**
 * Intraday OHLC Schema
 *
 * This schema tracks today's Open, High, Low, Close prices and intraday data points.
 * It resets daily and automatically cleans up after 2 days (keeps today + yesterday).
 *
 * Purpose:
 * - Track price movements throughout the current day
 * - Provide data for daily change calculations and mini-charts
 * - Enable real-time OHLC tracking without querying historical data
 *
 * TTL: 2 days (172,800 seconds) - keeps today and yesterday only
 */
@Schema({
  collection: 'intraday_ohlc',
  timestamps: true,
})
export class IntradayOhlc {
  /**
   * Item code (e.g., 'usd_sell', 'btc', 'sekkeh')
   */
  @Prop({ required: true, index: true })
  itemCode!: string;

  /**
   * Date in Tehran timezone (YYYY-MM-DD format)
   */
  @Prop({ required: true, index: true })
  date!: string;

  /**
   * Jalali date for display (YYYY/MM/DD format)
   */
  @Prop({ required: true })
  dateJalali!: string;

  /**
   * Opening price (first price of the day)
   */
  @Prop({ required: true })
  open!: number;

  /**
   * Highest price seen today
   */
  @Prop({ required: true })
  high!: number;

  /**
   * Lowest price seen today
   */
  @Prop({ required: true })
  low!: number;

  /**
   * Current/closing price (latest price)
   */
  @Prop({ required: true })
  close!: number;

  /**
   * Intraday data points for mini-chart
   * Max 144 points (24 hours at 10-minute intervals)
   */
  @Prop({ type: [{ time: String, price: Number }], default: [] })
  dataPoints!: DataPoint[];

  /**
   * Number of updates received today
   */
  @Prop({ default: 0 })
  updateCount!: number;

  /**
   * First update time of the day (market open)
   */
  @Prop()
  firstUpdate?: Date;

  /**
   * Last update time (most recent price)
   */
  @Prop()
  lastUpdate?: Date;
}

export const IntradayOhlcSchema = SchemaFactory.createForClass(IntradayOhlc);

// Unique index on itemCode and date
IntradayOhlcSchema.index({ itemCode: 1, date: 1 }, { unique: true });

// Query index for date-based queries
IntradayOhlcSchema.index({ date: -1 });

// TTL index - automatically delete records older than 2 days
// 2 days = 172,800 seconds
IntradayOhlcSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });
