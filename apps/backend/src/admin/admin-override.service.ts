import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ManagedItem, ManagedItemDocument } from '../schemas/managed-item.schema';

/**
 * AdminOverrideService
 *
 * Lightweight service for fetching admin overrides.
 * Designed to be injected into MarketDataOrchestratorService
 * without circular dependency issues.
 *
 * This service is separate from AdminService to avoid
 * importing the full admin module into market-data.
 */
@Injectable()
export class AdminOverrideService {
  private readonly logger = new Logger(AdminOverrideService.name);

  // In-memory cache for overrides
  private overrideCache: Map<string, { price: number; change?: number }> | null = null;
  private overrideCacheTimestamp: number = 0;
  private readonly OVERRIDE_CACHE_TTL = 60000; // 1 minute

  constructor(
    @InjectModel(ManagedItem.name)
    private readonly managedItemModel: Model<ManagedItemDocument>,
  ) {}

  /**
   * Get all overridden items with caching
   * Returns a Map keyed by lowercase item code
   */
  async getOverriddenItems(): Promise<Map<string, { price: number; change?: number }>> {
    const now = Date.now();

    // Return cached if still valid
    if (this.overrideCache && (now - this.overrideCacheTimestamp) < this.OVERRIDE_CACHE_TTL) {
      return this.overrideCache;
    }

    try {
      // Fetch from DB
      const items = await this.managedItemModel
        .find({ isOverridden: true, isActive: true })
        .select('code ohlcCode overridePrice overrideChange')
        .lean()
        .exec();

      const map = new Map<string, { price: number; change?: number }>();

      for (const item of items) {
        if (item.overridePrice !== undefined) {
          // Store by lowercase code for easy lookup
          map.set(item.code.toLowerCase(), {
            price: item.overridePrice,
            change: item.overrideChange,
          });
        }
      }

      // Update cache
      this.overrideCache = map;
      this.overrideCacheTimestamp = now;

      this.logger.debug(`Loaded ${map.size} price override(s) from database`);

      return map;
    } catch (error) {
      this.logger.warn(`Failed to fetch overrides: ${error instanceof Error ? error.message : String(error)}`);

      // Return empty map on error
      if (!this.overrideCache) {
        this.overrideCache = new Map();
      }
      return this.overrideCache;
    }
  }

  /**
   * Clear the override cache
   * Call this when an admin updates an override
   */
  clearCache(): void {
    this.overrideCache = null;
    this.overrideCacheTimestamp = 0;
    this.logger.debug('Override cache cleared');
  }

  /**
   * Apply overrides to market data response
   * Returns the data with any overridden prices replaced
   */
  async applyOverrides<T extends Record<string, unknown>>(data: T): Promise<T> {
    try {
      const overrides = await this.getOverriddenItems();

      if (overrides.size === 0) {
        return data;
      }

      // Create a shallow copy
      const result: Record<string, unknown> = { ...data };
      let overrideCount = 0;

      for (const [code, itemData] of Object.entries(result)) {
        if (!itemData || typeof itemData !== 'object' || code.startsWith('_')) continue;

        // Check for override by lowercase code
        const override = overrides.get(code.toLowerCase());
        if (override) {
          const item = itemData as Record<string, unknown>;
          result[code] = {
            ...item,
            value: String(override.price),
            change: override.change ?? item.change,
            _overridden: true, // Debug marker
          };
          overrideCount++;
        }
      }

      if (overrideCount > 0) {
        this.logger.debug(`Applied ${overrideCount} price override(s)`);
      }

      return result as T;
    } catch (error) {
      // Log but don't fail - overrides are enhancement
      this.logger.warn(`Failed to apply overrides: ${error instanceof Error ? error.message : String(error)}`);
      return data;
    }
  }
}
