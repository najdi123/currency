import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CacheDocument = Cache & Document;

@Schema({ timestamps: true })
export class Cache {
  @Prop({ required: true, index: true })
  category!: string; // e.g., 'currencies', 'crypto', 'gold', 'all'

  @Prop({ required: true, type: Object })
  data!: Record<string, unknown>; // Cached API response data

  @Prop({ required: true })
  timestamp!: Date; // When the data was cached

  @Prop({ required: true })
  expiresAt!: Date; // Auto-cleanup: when this cache entry should expire
}

export const CacheSchema = SchemaFactory.createForClass(Cache);

// TTL index for automatic cleanup of expired cache entries
// MongoDB will automatically delete documents when expiresAt is reached
CacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
