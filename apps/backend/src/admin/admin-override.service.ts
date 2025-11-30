import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ManagedItem, ManagedItemDocument, ItemSource } from '../schemas/managed-item.schema';

/**
 * ManualItemData - Data structure for manual items to inject
 */
interface ManualItemData {
  code: string;
  price: number;
  change?: number;
  parentCode?: string;
  region?: string;
  variant?: string;
  name: string;
  nameFa?: string;
  nameAr?: string;
}

/**
 * AdminOverrideService
 *
 * Lightweight service for fetching admin overrides and manual items.
 * Designed to be injected into MarketDataOrchestratorService
 * without circular dependency issues.
 *
 * This service is separate from AdminService to avoid
 * importing the full admin module into market-data.
 *
 * Responsibilities:
 * 1. Apply price overrides to existing API items
 * 2. Inject manual items (source='manual') into API response
 */
@Injectable()
export class AdminOverrideService {
  private readonly logger = new Logger(AdminOverrideService.name);

  // In-memory cache for overrides
  private overrideCache: Map<string, { price: number; change?: number }> | null = null;
  private overrideCacheTimestamp: number = 0;
  private readonly OVERRIDE_CACHE_TTL = 60000; // 1 minute

  // In-memory cache for manual items
  private manualItemsCache: ManualItemData[] | null = null;
  private manualItemsCacheTimestamp: number = 0;

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
    this.manualItemsCache = null;
    this.manualItemsCacheTimestamp = 0;
    this.logger.debug('Override and manual items cache cleared');
  }

  /**
   * Get all manual items (source='manual') with a price set
   * These are admin-created items like regional variants (usd_dubai_sell, etc.)
   */
  async getManualItems(): Promise<ManualItemData[]> {
    const now = Date.now();

    // Return cached if still valid
    if (this.manualItemsCache && (now - this.manualItemsCacheTimestamp) < this.OVERRIDE_CACHE_TTL) {
      return this.manualItemsCache;
    }

    try {
      // Fetch manual items that have a price set (either via override or initial price)
      const items = await this.managedItemModel
        .find({
          source: ItemSource.MANUAL,
          isActive: true,
          $or: [
            { overridePrice: { $exists: true, $ne: null } },
            { isOverridden: true },
          ],
        })
        .select('code parentCode region variant overridePrice overrideChange name nameFa nameAr')
        .lean()
        .exec();

      const manualItems: ManualItemData[] = items
        .filter(item => item.overridePrice !== undefined && item.overridePrice !== null)
        .map(item => ({
          code: item.code,
          price: item.overridePrice!,
          change: item.overrideChange,
          parentCode: item.parentCode,
          region: item.region,
          variant: item.variant,
          name: item.name,
          nameFa: item.nameFa,
          nameAr: item.nameAr,
        }));

      // Update cache
      this.manualItemsCache = manualItems;
      this.manualItemsCacheTimestamp = now;

      this.logger.debug(`Loaded ${manualItems.length} manual item(s) from database`);

      return manualItems;
    } catch (error) {
      this.logger.warn(`Failed to fetch manual items: ${error instanceof Error ? error.message : String(error)}`);

      // Return cached or empty array on error
      return this.manualItemsCache || [];
    }
  }

  /**
   * Apply overrides and inject manual items into market data response
   *
   * This method does two things:
   * 1. Replaces prices for existing items that have overrides
   * 2. Injects new manual items (regional variants) that don't exist in API data
   *
   * Returns the data with overridden prices and injected manual items
   */
  async applyOverrides<T extends Record<string, unknown>>(data: T): Promise<T> {
    try {
      // Fetch both overrides and manual items in parallel
      const [overrides, manualItems] = await Promise.all([
        this.getOverriddenItems(),
        this.getManualItems(),
      ]);

      // Create a shallow copy
      const result: Record<string, unknown> = { ...data };
      let overrideCount = 0;
      let injectedCount = 0;

      // Step 1: Apply overrides to existing items
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

      // Step 2: Inject manual items that don't exist in API data
      for (const manualItem of manualItems) {
        const code = manualItem.code.toLowerCase();

        // Only inject if it doesn't already exist in the response
        if (!result[code]) {
          result[code] = {
            value: String(manualItem.price),
            change: manualItem.change ?? 0,
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0],
            _manual: true, // Debug marker for manual items
            _parentCode: manualItem.parentCode,
            _region: manualItem.region,
            _variant: manualItem.variant,
            _name: manualItem.name,
            _nameFa: manualItem.nameFa,
            _nameAr: manualItem.nameAr,
          };
          injectedCount++;
        }
      }

      if (overrideCount > 0 || injectedCount > 0) {
        this.logger.debug(
          `Applied ${overrideCount} override(s), injected ${injectedCount} manual item(s)`
        );
      }

      return result as T;
    } catch (error) {
      // Log but don't fail - overrides are enhancement
      this.logger.warn(`Failed to apply overrides: ${error instanceof Error ? error.message : String(error)}`);
      return data;
    }
  }

  /**
   * Get all manual items grouped by parent code
   * Useful for frontend to fetch regional variants for a specific currency
   */
  async getManualItemsByParent(parentCode: string): Promise<ManualItemData[]> {
    const allManualItems = await this.getManualItems();
    return allManualItems.filter(item => item.parentCode === parentCode.toLowerCase());
  }
}
