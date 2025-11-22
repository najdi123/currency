import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type WalletDocument = Wallet & Document;

/**
 * We store one document per (userId, currencyCode) to keep updates cheap and indexed.
 */
@Schema({ collection: "wallets", timestamps: true })
export class Wallet {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: ["fiat", "crypto", "gold"], index: true })
  currencyType!: "fiat" | "crypto" | "gold";

  @Prop({ required: true, index: true })
  currencyCode!: string; // e.g. 'USD', 'BTC', 'SEKKEH'

  @Prop({
    type: Types.Decimal128,
    required: true,
    default: () => Types.Decimal128.fromString("0"),
  })
  amount!: Types.Decimal128; // always non-negative

  @Prop({ required: true, default: 0 })
  version!: number; // optimistic concurrency (manual bump inside tx)
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);

// unique per currency
WalletSchema.index({ userId: 1, currencyCode: 1 }, { unique: true });

// toJSON transform -> string for Decimal128
WalletSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    if (ret.amount?.toString) ret.amount = ret.amount.toString();
    return ret;
  },
});
