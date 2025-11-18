import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserRateLimitDocument = UserRateLimit & Document;

export enum UserTier {
  FREE = 'free',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

@Schema({ collection: 'user_rate_limits', timestamps: true })
export class UserRateLimit {
  @Prop({ required: true })
  identifier: string; // User ID or IP address

  @Prop({ required: true, enum: Object.values(UserTier), default: UserTier.FREE })
  tier: UserTier;

  @Prop({ required: true, type: Number, default: 0 })
  requestsToday: number;

  @Prop({ required: true, type: Number })
  dailyLimit: number; // Based on tier

  @Prop({ type: Date })
  lastRequest?: Date;

  @Prop({ required: true, type: Date })
  resetAt: Date; // Midnight UTC

  @Prop({ type: Boolean, default: false })
  isBlocked: boolean;

  @Prop({ type: String })
  blockReason?: string;

  @Prop({ type: Object })
  metadata?: {
    lastEndpoint?: string;
    consecutiveFailures?: number;
    tier_upgraded_at?: Date;
  };
}

export const UserRateLimitSchema = SchemaFactory.createForClass(UserRateLimit);

// Indexes
UserRateLimitSchema.index({ identifier: 1 }, { unique: true });
UserRateLimitSchema.index({ tier: 1 });

// TTL index to clean up old rate limit records after 7 days
// This also serves as a regular index on resetAt, so no separate index is needed
UserRateLimitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
