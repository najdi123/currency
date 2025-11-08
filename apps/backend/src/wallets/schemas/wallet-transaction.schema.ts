import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WalletTransactionDocument = WalletTransaction & Document;

@Schema({ collection: 'wallet_transactions', timestamps: true })
export class WalletTransaction {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: ['fiat', 'crypto', 'gold'] })
  currencyType!: 'fiat' | 'crypto' | 'gold';

  @Prop({ required: true })
  currencyCode!: string;

  @Prop({ required: true, enum: ['credit', 'debit'] })
  direction!: 'credit' | 'debit';

  @Prop({ required: true, enum: ['deposit', 'withdrawal', 'transfer', 'adjustment'] })
  reason!: 'deposit' | 'withdrawal' | 'transfer' | 'adjustment';

  @Prop({ type: Types.Decimal128, required: true })
  amount!: Types.Decimal128;

  @Prop({ type: Types.Decimal128, required: true })
  balanceAfter!: Types.Decimal128;

  @Prop() requestId?: Types.ObjectId;         // link to TransferRequest if any
  @Prop() processedBy?: Types.ObjectId;       // admin user id (if admin action)

  // Idempotency: prevent duplicate postings
  @Prop({ index: true })
  idempotencyKey?: string;

  // free-form metadata (ip, userAgent, notes…)
  @Prop({ type: Object })
  meta?: Record<string, unknown>;
}

export const WalletTransactionSchema = SchemaFactory.createForClass(WalletTransaction);

// fast reads per user and currency
WalletTransactionSchema.index({ userId: 1, currencyCode: 1, createdAt: -1 });

// enforce idempotency per user
WalletTransactionSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, sparse: true },
);

WalletTransactionSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    if (ret.amount?.toString) ret.amount = ret.amount.toString();
    if (ret.balanceAfter?.toString) ret.balanceAfter = ret.balanceAfter.toString();
    return ret;
  },
});
