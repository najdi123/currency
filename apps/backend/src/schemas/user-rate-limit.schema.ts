import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserRateLimitDocument = UserRateLimit & Document;

export interface RequestHistoryItem {
  timestamp: Date;
  endpoint?: string;
  itemType?: string;
}

/**
 * Rate Limit Schema - 2-hour window system
 *
 * Purpose: Track fresh data request quota (20 requests per 2 hours per user)
 * Documents: ~1,000 active windows
 * Growth: Controlled by TTL (auto-delete after 3 hours)
 */
@Schema({ collection: 'user_rate_limits', timestamps: true })
export class UserRateLimit {
  @Prop({ required: true })
  identifier: string; // User ID or IP address (e.g., 'user_123' or 'ip_1.2.3.4')

  @Prop({ required: true, type: Date })
  windowStart: Date; // Start of 2-hour window

  @Prop({ required: true, type: Date })
  windowEnd: Date; // End of 2-hour window

  @Prop({ required: true, type: Number, default: 0, min: 0, max: 20 })
  freshRequestsUsed: number; // Out of 20 allowed

  @Prop({ type: Date })
  lastRequest?: Date;

  @Prop({
    type: Array,
    default: [],
    validate: {
      validator: function (arr: RequestHistoryItem[]) {
        return arr.length <= 50;
      },
      message: 'Request history cannot exceed 50 items',
    },
  })
  requestHistory?: RequestHistoryItem[]; // Last 50 requests

  @Prop({ type: Number, default: 1 })
  schemaVersion: number; // Schema version for future migrations (current: 1)

  @Prop({ type: Date, default: Date.now })
  createdAt: Date; // For TTL index
}

export const UserRateLimitSchema = SchemaFactory.createForClass(UserRateLimit);

// Indexes
// Primary: Find user's current window + prevent duplicate windows
UserRateLimitSchema.index({ identifier: 1, windowStart: 1 }, { unique: true });

// Query: Clean up expired windows
UserRateLimitSchema.index({ windowEnd: 1 });

// TTL index: Auto-delete after 3 hours (2-hour window + 1 hour buffer)
UserRateLimitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3 * 60 * 60 });
