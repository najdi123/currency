import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserRateLimit, UserRateLimitDocument, UserTier } from '../schemas/user-rate-limit.schema';

export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfter?: number; // seconds
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  // Tier limits (requests per day) - configurable via environment variables
  private readonly tierLimits: Record<UserTier, number>;

  constructor(
    @InjectModel(UserRateLimit.name)
    private userRateLimitModel: Model<UserRateLimitDocument>,
    private configService: ConfigService,
  ) {
    // Load tier limits from config with validation and fallback to defaults
    this.tierLimits = {
      [UserTier.FREE]: this.parseLimit('RATE_LIMIT_FREE', 100),
      [UserTier.PREMIUM]: this.parseLimit('RATE_LIMIT_PREMIUM', 1000),
      [UserTier.ENTERPRISE]: this.parseLimit('RATE_LIMIT_ENTERPRISE', 10000),
    };

    this.logger.log(
      `Rate limits configured: FREE=${this.tierLimits[UserTier.FREE]}, ` +
      `PREMIUM=${this.tierLimits[UserTier.PREMIUM]}, ` +
      `ENTERPRISE=${this.tierLimits[UserTier.ENTERPRISE]}`
    );
  }

  /**
   * Safely parse and validate rate limit configuration values
   */
  private parseLimit(key: string, defaultValue: number): number {
    const value = this.configService.get<string>(key);
    if (!value) return defaultValue;

    const parsed = parseInt(value, 10);

    // Validate: must be positive integer
    if (isNaN(parsed) || parsed < 1 || parsed > 1000000) {
      this.logger.warn(
        `Invalid ${key}="${value}" (must be 1-1000000). Using default: ${defaultValue}`
      );
      return defaultValue;
    }

    return parsed;
  }

  /**
   * Check if a request is allowed and update rate limit
   */
  async checkRateLimit(
    identifier: string,
    tier: UserTier = UserTier.FREE,
  ): Promise<RateLimitCheck> {
    const now = new Date();
    const resetAt = this.getNextResetTime();

    // Get or create rate limit record
    let rateLimitRecord = await this.userRateLimitModel.findOne({ identifier }).exec();

    if (!rateLimitRecord) {
      rateLimitRecord = await this.createRateLimitRecord(identifier, tier, resetAt) as any;
    }

    // Reset if we've passed the reset time
    if (now >= rateLimitRecord!.resetAt) {
      const resetRecord = await this.resetRateLimit(rateLimitRecord!, resetAt);
      if (resetRecord) {
        rateLimitRecord = resetRecord as any;
      }
    }

    // Check if blocked
    if (rateLimitRecord!.isBlocked) {
      return {
        allowed: false,
        remaining: 0,
        limit: rateLimitRecord!.dailyLimit,
        resetAt: rateLimitRecord!.resetAt,
        retryAfter: Math.ceil((rateLimitRecord!.resetAt.getTime() - now.getTime()) / 1000),
      };
    }

    // Check if limit exceeded
    const allowed = rateLimitRecord!.requestsToday < rateLimitRecord!.dailyLimit;
    const remaining = Math.max(0, rateLimitRecord!.dailyLimit - rateLimitRecord!.requestsToday);

    if (allowed) {
      // Increment request count
      await this.userRateLimitModel.updateOne(
        { identifier },
        {
          $inc: { requestsToday: 1 },
          $set: { lastRequest: now },
        },
      ).exec();
    }

    return {
      allowed,
      remaining: allowed ? remaining - 1 : remaining,
      limit: rateLimitRecord!.dailyLimit,
      resetAt: rateLimitRecord!.resetAt,
      retryAfter: allowed ? undefined : Math.ceil((rateLimitRecord!.resetAt.getTime() - now.getTime()) / 1000),
    };
  }

  /**
   * Get rate limit status without incrementing count
   */
  async getRateLimitStatus(identifier: string): Promise<RateLimitCheck> {
    const rateLimitRecord = await this.userRateLimitModel.findOne({ identifier }).exec();

    if (!rateLimitRecord) {
      const resetAt = this.getNextResetTime();
      return {
        allowed: true,
        remaining: this.tierLimits[UserTier.FREE],
        limit: this.tierLimits[UserTier.FREE],
        resetAt,
      };
    }

    const now = new Date();
    const remaining = Math.max(0, rateLimitRecord.dailyLimit - rateLimitRecord.requestsToday);

    return {
      allowed: remaining > 0,
      remaining,
      limit: rateLimitRecord.dailyLimit,
      resetAt: rateLimitRecord.resetAt,
      retryAfter: remaining === 0
        ? Math.ceil((rateLimitRecord.resetAt.getTime() - now.getTime()) / 1000)
        : undefined,
    };
  }

  /**
   * Upgrade user tier
   */
  async upgradeTier(identifier: string, newTier: UserTier): Promise<void> {
    await this.userRateLimitModel.updateOne(
      { identifier },
      {
        $set: {
          tier: newTier,
          dailyLimit: this.tierLimits[newTier],
          'metadata.tier_upgraded_at': new Date(),
        },
      },
      { upsert: true },
    ).exec();

    this.logger.log(`Upgraded ${identifier} to ${newTier}`);
  }

  private async createRateLimitRecord(
    identifier: string,
    tier: UserTier,
    resetAt: Date,
  ) {
    return this.userRateLimitModel.create({
      identifier,
      tier,
      dailyLimit: this.tierLimits[tier],
      requestsToday: 0,
      resetAt,
      isBlocked: false,
    });
  }

  private async resetRateLimit(
    record: UserRateLimitDocument,
    newResetAt: Date,
  ) {
    await this.userRateLimitModel.updateOne(
      { identifier: record.identifier },
      {
        $set: {
          requestsToday: 0,
          resetAt: newResetAt,
          isBlocked: false,
          blockReason: null,
        },
      },
    ).exec();

    return this.userRateLimitModel.findOne({ identifier: record.identifier }).exec();
  }

  private getNextResetTime(): Date {
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0); // Next midnight UTC
    return tomorrow;
  }
}
