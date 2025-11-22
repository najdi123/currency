import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model, Types } from "mongoose";
import { Wallet, WalletDocument } from "./schemas/wallet.schema";
import {
  WalletTransaction,
  WalletTransactionDocument,
} from "./schemas/wallet-transaction.schema";
import { CurrencyType, TransactionDirection, TransactionReason } from "./types";
import { decimal128ToNumber, toDecimal128 } from "../common/utils/decimal";

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Wallet.name)
    private readonly walletModel: Model<WalletDocument>,
    @InjectModel(WalletTransaction.name)
    private readonly txModel: Model<WalletTransactionDocument>,
  ) {}

  /**
   * Get all wallets for a user
   */
  async getUserWallet(userId: string | Types.ObjectId) {
    const uid =
      typeof userId === "string" ? new Types.ObjectId(userId) : userId;
    const docs = await this.walletModel.find({ userId: uid }).lean().exec();
    return docs.map((d) => ({
      ...d,
      amount: Number((d as any).amount),
    }));
  }

  /**
   * Create default wallets for a new user
   * Creates wallets with 0 balance for the most commonly used currencies
   * This ensures every user has wallets ready for transactions
   */
  async createDefaultWallets(userId: string | Types.ObjectId): Promise<void> {
    const uid =
      typeof userId === "string" ? new Types.ObjectId(userId) : userId;

    // Define default currencies to create wallets for
    // These are the most commonly used currencies in the system
    const defaultCurrencies: Array<{
      currencyType: CurrencyType;
      currencyCode: string;
    }> = [
      // Fiat currencies
      { currencyType: "fiat" as CurrencyType, currencyCode: "USD" },
      { currencyType: "fiat" as CurrencyType, currencyCode: "EUR" },
      // Cryptocurrencies
      { currencyType: "crypto" as CurrencyType, currencyCode: "BTC" },
      { currencyType: "crypto" as CurrencyType, currencyCode: "ETH" },
      { currencyType: "crypto" as CurrencyType, currencyCode: "USDT" },
      // Gold (most popular)
      { currencyType: "gold" as CurrencyType, currencyCode: "SEKKEH" },
    ];

    // Create wallet documents with 0 balance
    const wallets = defaultCurrencies.map(({ currencyType, currencyCode }) => ({
      userId: uid,
      currencyType,
      currencyCode,
      amount: toDecimal128(0),
      version: 0,
    }));

    try {
      // Use insertMany with ordered: false to insert as many as possible
      // even if some already exist (duplicate key errors)
      await this.walletModel.insertMany(wallets, { ordered: false });
      this.logger.log(
        `Created ${wallets.length} default wallets for user ${userId}`,
      );
    } catch (error: any) {
      // If some wallets already exist (duplicate key error code 11000), that's okay
      // We only want to create the ones that don't exist yet
      if (error.code === 11000) {
        // Count how many were actually inserted by checking the writeErrors
        const insertedCount = wallets.length - (error.writeErrors?.length || 0);
        if (insertedCount > 0) {
          this.logger.log(
            `Created ${insertedCount} default wallets for user ${userId} (${error.writeErrors?.length || 0} already existed)`,
          );
        } else {
          this.logger.warn(
            `All default wallets already exist for user ${userId}`,
          );
        }
      } else {
        // For other errors, log and re-throw
        this.logger.error(
          `Failed to create default wallets for user ${userId}: ${error.message}`,
          error.stack,
        );
        throw error;
      }
    }
  }

  /**
   * Core balance adjuster (atomic version)
   * Uses atomic MongoDB operations to prevent race conditions
   */
  async adjustBalance(params: {
    userId: string | Types.ObjectId;
    currencyType: CurrencyType;
    currencyCode: string;
    direction: TransactionDirection; // 'credit' | 'debit'
    amount: number | string;
    reason: TransactionReason;
    processedBy?: string | Types.ObjectId;
    requestId?: string | Types.ObjectId;
    idempotencyKey?: string;
    meta?: Record<string, unknown>;
  }) {
    const uid = new Types.ObjectId(params.userId);
    const pid = params.processedBy
      ? new Types.ObjectId(params.processedBy)
      : undefined;
    const rid = params.requestId
      ? new Types.ObjectId(params.requestId)
      : undefined;

    const positiveAmount = Number(params.amount);
    if (!Number.isFinite(positiveAmount) || positiveAmount <= 0) {
      throw new BadRequestException("amount must be a positive number");
    }

    // Idempotency check (standalone-safe)
    if (params.idempotencyKey) {
      const dup = await this.txModel.findOne({
        userId: uid,
        idempotencyKey: params.idempotencyKey,
      });
      if (dup) {
        this.logger.log(
          `Skipping duplicate operation: ${params.idempotencyKey}`,
        );
        return dup.toJSON();
      }
    }

    // Build query for atomic update
    const query: any = {
      userId: uid,
      currencyCode: params.currencyCode,
    };

    // For debits, ensure sufficient balance atomically
    if (params.direction === "debit") {
      query.amount = { $gte: toDecimal128(positiveAmount) };
    }

    // Calculate the delta for $inc operation
    const delta =
      params.direction === "credit" ? positiveAmount : -positiveAmount;

    // Attempt atomic update
    let wallet = await this.walletModel.findOneAndUpdate(
      query,
      {
        $inc: {
          amount: toDecimal128(delta),
          version: 1,
        },
      },
      { new: true, upsert: false },
    );

    // Handle cases where atomic update failed
    if (!wallet) {
      if (params.direction === "debit") {
        // Debit failed - either wallet doesn't exist or insufficient balance
        const existingWallet = await this.walletModel.findOne({
          userId: uid,
          currencyCode: params.currencyCode,
        });
        if (!existingWallet) {
          throw new ForbiddenException(
            `Wallet not found for currency ${params.currencyCode}`,
          );
        }
        throw new ForbiddenException("Insufficient balance");
      } else {
        // Credit failed - wallet doesn't exist, create it
        try {
          wallet = await this.walletModel.create({
            userId: uid,
            currencyType: params.currencyType,
            currencyCode: params.currencyCode,
            amount: toDecimal128(positiveAmount),
            version: 1,
          });
        } catch (error: any) {
          // Handle race condition where wallet was created between our check and create
          if (error.code === 11000) {
            // Retry the atomic update once
            wallet = await this.walletModel.findOneAndUpdate(
              { userId: uid, currencyCode: params.currencyCode },
              {
                $inc: {
                  amount: toDecimal128(delta),
                  version: 1,
                },
              },
              { new: true },
            );
            if (!wallet) {
              throw new BadRequestException(
                "Failed to update wallet after retry",
              );
            }
          } else {
            throw error;
          }
        }
      }
    }

    // Create transaction record
    const tx = await this.txModel.create({
      userId: uid,
      currencyType: params.currencyType,
      currencyCode: params.currencyCode,
      direction: params.direction,
      reason: params.reason,
      amount: toDecimal128(positiveAmount),
      balanceAfter: wallet.amount,
      processedBy: pid,
      requestId: rid,
      idempotencyKey: params.idempotencyKey,
      meta: params.meta,
    });

    this.logger.log(
      `Adjusted balance for ${params.userId} ${params.currencyCode} ${params.direction} ${params.amount}`,
    );

    return tx.toJSON();
  }

  /**
   * Get transaction history for a user
   */
  async getTransactionHistory(
    userId: string | Types.ObjectId,
    options: {
      page: number;
      pageSize: number;
      currencyCode?: string;
      direction?: "credit" | "debit";
    },
  ) {
    const uid =
      typeof userId === "string" ? new Types.ObjectId(userId) : userId;

    const filter: any = { userId: uid };
    if (options.currencyCode) {
      filter.currencyCode = options.currencyCode;
    }
    if (options.direction) {
      filter.direction = options.direction;
    }

    const skip = (options.page - 1) * options.pageSize;
    const limit = options.pageSize;

    const [items, total] = await Promise.all([
      this.txModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.txModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        amount: decimal128ToNumber(item.amount),
        balanceAfter: decimal128ToNumber(item.balanceAfter),
      })),
      total,
      page: options.page,
      pageSize: options.pageSize,
      totalPages: Math.ceil(total / options.pageSize),
    };
  }

  /**
   * List all wallets with pagination (admin only)
   */
  async listAllWallets(options: { page: number; pageSize: number }) {
    const skip = (options.page - 1) * options.pageSize;
    const limit = options.pageSize;

    const [items, total] = await Promise.all([
      this.walletModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.walletModel.countDocuments(),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        amount: decimal128ToNumber(item.amount),
      })),
      total,
      page: options.page,
      pageSize: options.pageSize,
      totalPages: Math.ceil(total / options.pageSize),
    };
  }
}
