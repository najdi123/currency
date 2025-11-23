import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { Model } from "mongoose";
import moment from "moment-timezone";
import {
  UserRateLimit,
  UserRateLimitDocument,
} from "../schemas/user-rate-limit.schema";
import { MetricsService } from "../metrics/metrics.service";

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number; // seconds until window reset
  windowStart: Date;
  windowEnd: Date;
  showStaleData: boolean;
}

/**
 * Rate Limit Service - 2-hour window system
 *
 * Implements: 20 fresh requests per 2-hour window per user
 * Windows: 00:00-02:00, 02:00-04:00, ..., 22:00-00:00
 * Quota exceeded: Show stale data with friendly message
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly WINDOW_DURATION_MS: number;
  private readonly MAX_REQUESTS_PER_WINDOW: number;

  constructor(
    @InjectModel(UserRateLimit.name)
    private readonly rateLimitModel: Model<UserRateLimitDocument>,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    // Load configuration with validation and defaults
    const windowHours = this.parseConfig("RATE_LIMIT_WINDOW_HOURS", 2, 1, 24);
    const maxRequests = this.parseConfig(
      "RATE_LIMIT_MAX_REQUESTS",
      20,
      1,
      1000,
    );

    this.WINDOW_DURATION_MS = windowHours * 60 * 60 * 1000;
    this.MAX_REQUESTS_PER_WINDOW = maxRequests;

    this.logger.log(
      `Rate limiting configured: ${this.MAX_REQUESTS_PER_WINDOW} requests per ${windowHours}-hour window`,
    );
  }

  /**
   * Safely parse and validate configuration values
   */
  private parseConfig(
    key: string,
    defaultValue: number,
    min: number,
    max: number,
  ): number {
    const value = this.configService.get<string>(key);
    if (!value) return defaultValue;

    const parsed = parseInt(value, 10);

    if (isNaN(parsed) || parsed < min || parsed > max) {
      this.logger.warn(
        `Invalid ${key}="${value}" (must be ${min}-${max}). Using default: ${defaultValue}`,
      );
      return defaultValue;
    }

    return parsed;
  }

  /**
   * Get current 2-hour window boundaries in Tehran timezone
   * Windows start at: 00:00, 02:00, 04:00, 06:00, etc. (Tehran time)
   *
   * @returns Window boundaries as UTC Date objects
   */
  private getCurrentWindow(): { start: Date; end: Date } {
    // Get current time in Tehran timezone (UTC+3:30)
    const tehranTime = moment().tz("Asia/Tehran");

    // Get hour of day in Tehran (0-23)
    const hourOfDay = tehranTime.hours();

    // Calculate which window we're in (window duration in hours)
    const windowDurationHours = this.WINDOW_DURATION_MS / (60 * 60 * 1000);
    const windowNumber = Math.floor(hourOfDay / windowDurationHours);

    // Calculate window start in Tehran time
    const windowStartInTehran = tehranTime
      .clone()
      .startOf("day")
      .add(windowNumber * windowDurationHours, "hours");

    // Calculate window end in Tehran time
    const windowEndInTehran = windowStartInTehran
      .clone()
      .add(windowDurationHours, "hours");

    // Convert to UTC Date objects for storage
    return {
      start: windowStartInTehran.toDate(),
      end: windowEndInTehran.toDate(),
    };
  }

  /**
   * Check if user has quota remaining
   * Returns information about rate limit status
   */
  async checkQuota(identifier: string): Promise<RateLimitCheckResult> {
    const window = this.getCurrentWindow();

    try {
      const record = await this.rateLimitModel.findOne({
        identifier,
        windowStart: window.start,
      });

      if (!record) {
        // First request in this window
        return {
          allowed: true,
          remaining: this.MAX_REQUESTS_PER_WINDOW - 1,
          windowStart: window.start,
          windowEnd: window.end,
          showStaleData: false,
        };
      }

      if (record.freshRequestsUsed >= this.MAX_REQUESTS_PER_WINDOW) {
        // Quota exceeded - must wait for next window
        const now = new Date();
        const retryAfter = Math.ceil(
          (window.end.getTime() - now.getTime()) / 1000,
        );

        this.logger.warn(
          `Rate limit exceeded for ${identifier}. Retry in ${retryAfter}s`,
        );

        return {
          allowed: false,
          remaining: 0,
          retryAfter,
          windowStart: window.start,
          windowEnd: window.end,
          showStaleData: true,
        };
      }

      // Has quota remaining
      return {
        allowed: true,
        remaining: this.MAX_REQUESTS_PER_WINDOW - record.freshRequestsUsed,
        windowStart: window.start,
        windowEnd: window.end,
        showStaleData: false,
      };
    } catch (error) {
      this.logger.error(`Error checking quota for ${identifier}:`, error);
      // On error, allow request (fail open for availability)
      return {
        allowed: true,
        remaining: this.MAX_REQUESTS_PER_WINDOW,
        windowStart: window.start,
        windowEnd: window.end,
        showStaleData: false,
      };
    }
  }

  /**
   * Atomically check and consume quota in a single database operation
   * Prevents race conditions where concurrent requests could exceed the limit
   *
   * @returns RateLimitCheckResult with consumption already applied if allowed
   */
  async checkAndConsumeQuota(
    identifier: string,
    metadata?: { endpoint?: string; itemType?: string },
  ): Promise<RateLimitCheckResult> {
    const window = this.getCurrentWindow();

    try {
      // Attempt to increment only if under limit (atomic operation)
      const result = await this.rateLimitModel.findOneAndUpdate(
        {
          identifier,
          windowStart: window.start,
          freshRequestsUsed: { $lt: this.MAX_REQUESTS_PER_WINDOW },
        },
        {
          $inc: { freshRequestsUsed: 1 },
          $set: {
            lastRequest: new Date(),
            windowEnd: window.end,
          },
          $setOnInsert: {
            windowStart: window.start,
            createdAt: new Date(),
          },
          $push: {
            requestHistory: {
              $each: [
                {
                  timestamp: new Date(),
                  ...metadata,
                },
              ],
              $slice: -50,
            },
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      );

      if (!result) {
        // Quota was already at limit, check current status
        const existing = await this.rateLimitModel.findOne({
          identifier,
          windowStart: window.start,
        });

        if (
          existing &&
          existing.freshRequestsUsed >= this.MAX_REQUESTS_PER_WINDOW
        ) {
          const now = new Date();
          const retryAfter = Math.ceil(
            (window.end.getTime() - now.getTime()) / 1000,
          );

          this.logger.warn(
            `Rate limit exceeded for ${identifier}. Retry in ${retryAfter}s`,
          );

          // Track quota exhaustion metric
          this.metricsService.trackRateLimitQuotaExhausted(identifier);

          return {
            allowed: false,
            remaining: 0,
            retryAfter,
            windowStart: window.start,
            windowEnd: window.end,
            showStaleData: true,
          };
        }
      }

      // Successfully consumed quota
      const remaining = Math.max(
        0,
        this.MAX_REQUESTS_PER_WINDOW - (result?.freshRequestsUsed || 1),
      );

      this.logger.debug(
        `Consumed quota for ${identifier}, remaining: ${remaining}`,
      );

      // Track metrics
      this.metricsService.trackRateLimitQuotaConsumed(
        identifier,
        metadata?.endpoint,
        metadata?.itemType,
      );

      return {
        allowed: true,
        remaining,
        windowStart: window.start,
        windowEnd: window.end,
        showStaleData: false,
      };
    } catch (error) {
      this.logger.error(
        `Error in checkAndConsumeQuota for ${identifier}:`,
        error,
      );

      // Track error metric
      this.metricsService.trackRateLimitError(
        error instanceof Error ? error.message : String(error),
      );

      // Fail-open: Allow request on error
      return {
        allowed: true,
        remaining: this.MAX_REQUESTS_PER_WINDOW,
        windowStart: window.start,
        windowEnd: window.end,
        showStaleData: false,
      };
    }
  }

  /**
   * Get rate limit status for a user
   * Used for displaying information to frontend
   */
  async getRateLimitStatus(identifier: string): Promise<RateLimitCheckResult> {
    return this.checkQuota(identifier);
  }

  /**
   * Reset rate limit for a user (admin function)
   */
  async resetUserLimit(identifier: string): Promise<void> {
    const window = this.getCurrentWindow();
    await this.rateLimitModel.deleteMany({
      identifier,
      windowStart: window.start,
    });
    this.logger.log(`Reset rate limit for ${identifier}`);
  }

  /**
   * Validate identifier format
   * @throws Error if identifier is invalid
   */
  private validateIdentifier(identifier: string): void {
    if (!identifier || identifier.trim() === "") {
      throw new Error("Identifier cannot be empty");
    }

    if (
      identifier === "ip_unknown" ||
      identifier === "ip_undefined" ||
      identifier === "ip_null"
    ) {
      throw new Error("Invalid IP identifier");
    }

    // Basic format validation
    if (!identifier.match(/^(user_[a-zA-Z0-9-_]+|ip_[\d.a-fA-F:]+)$/)) {
      throw new Error(`Invalid identifier format: ${identifier}`);
    }
  }

  /**
   * Get identifier from request
   * Uses user ID if authenticated, otherwise IP address
   */
  getIdentifierFromRequest(request: any): string {
    // Check for authenticated user
    if (request.user?.id) {
      const userId = String(request.user.id);
      const identifier = `user_${userId}`;
      this.validateIdentifier(identifier);
      return identifier;
    }

    // Fallback to IP address
    const forwarded = request.headers["x-forwarded-for"];
    let ip = forwarded ? forwarded.split(",")[0].trim() : request.ip;

    // Validate IP exists
    if (!ip || ip === "undefined" || ip === "null") {
      ip = "127.0.0.1"; // Fallback to localhost for local dev
      this.logger.warn("Could not determine IP address, using localhost");
    }

    const identifier = `ip_${ip}`;
    this.validateIdentifier(identifier);
    return identifier;
  }

  /**
   * Get the maximum number of requests allowed per window
   * Used by controller and other services to display quota information
   */
  getMaxRequestsPerWindow(): number {
    return this.MAX_REQUESTS_PER_WINDOW;
  }

  /**
   * Get the window duration in hours
   * Used by controller to display window duration to frontend
   */
  getWindowDurationHours(): number {
    return this.WINDOW_DURATION_MS / (60 * 60 * 1000);
  }

  /**
   * Cleanup old rate limit records (maintenance function)
   * TTL index should handle this automatically, but this is a manual fallback
   */
  async cleanupOldRecords(): Promise<number> {
    const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
    const result = await this.rateLimitModel.deleteMany({
      windowEnd: { $lt: cutoff },
    });
    this.logger.log(`Cleaned up ${result.deletedCount} old rate limit records`);
    return result.deletedCount;
  }
}
