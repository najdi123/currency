import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';

export type RefreshTokenDocument = RefreshToken & Document;

@Schema({ timestamps: true, collection: 'refresh_tokens' })
export class RefreshToken {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true })
  userId!: mongoose.Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  token!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: Date.now })
  createdAt!: Date;

  @Prop({ type: String })
  userAgent?: string;

  @Prop({ type: String })
  ipAddress?: string;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// Index for automatic cleanup of expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
