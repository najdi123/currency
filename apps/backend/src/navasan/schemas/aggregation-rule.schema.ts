import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AggregationRuleDocument = AggregationRule & Document;

@Schema({
  timestamps: true,
  collection: 'ohlc_aggregation_rules'
})
export class AggregationRule {
  @Prop({ required: true })
  sourceTimeframe!: string;

  @Prop({ required: true })
  targetTimeframe!: string;

  @Prop({ required: true, enum: ['standard', 'weighted', 'custom'], default: 'standard' })
  aggregationMethod!: string;

  @Prop({ required: true, default: 1 })
  minDataPoints!: number;

  @Prop({ default: true })
  enabled!: boolean;

  @Prop({ default: null })
  lastExecuted!: Date;

  @Prop({ default: 0 })
  executionCount!: number;

  @Prop({ default: 0 })
  failureCount!: number;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, any>;
}

export const AggregationRuleSchema = SchemaFactory.createForClass(AggregationRule);

// Create indexes
AggregationRuleSchema.index({ sourceTimeframe: 1, targetTimeframe: 1 }, { unique: true });
AggregationRuleSchema.index({ enabled: 1 });
AggregationRuleSchema.index({ lastExecuted: 1 });