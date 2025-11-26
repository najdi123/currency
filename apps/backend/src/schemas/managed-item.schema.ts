import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ManagedItemDocument = ManagedItem & Document;

/**
 * ItemCategory - Type of market item
 */
export enum ItemCategory {
  CURRENCY = 'currency',
  CRYPTO = 'crypto',
  GOLD = 'gold',
}

/**
 * ItemSource - Where the price data comes from
 */
export enum ItemSource {
  API = 'api',
  MANUAL = 'manual',
}

/**
 * ItemVariant - For buy/sell variants of same currency
 */
export enum ItemVariant {
  SELL = 'sell',
  BUY = 'buy',
}

/**
 * ManagedItem Schema
 *
 * Admin layer for managing market items. This collection provides:
 * - Display configuration (names, icons, ordering)
 * - Price override capability for admin corrections
 * - Manual item support for items without API data
 * - Mapping between API codes and display codes
 *
 * IMPORTANT: This is NOT the source of truth for prices.
 * Prices come from ohlc_permanent collection.
 * This collection only provides admin overrides and display settings.
 */
@Schema({
  timestamps: true,
  collection: 'managed_items',
})
export class ManagedItem {
  // ==================== IDENTITY ====================

  /**
   * Lowercase code for API responses (e.g., "usd_sell")
   */
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  code!: string;

  /**
   * UPPERCASE code for ohlc_permanent queries (e.g., "USD_SELL")
   */
  @Prop({ required: true, uppercase: true, trim: true, index: true })
  ohlcCode!: string;

  /**
   * Parent code for grouping variants (e.g., "usd" groups usd_sell, usd_buy)
   */
  @Prop({ lowercase: true, trim: true, index: true })
  parentCode?: string;

  // ==================== DISPLAY ====================

  /**
   * Display name in English
   */
  @Prop({ required: true, trim: true })
  name!: string;

  /**
   * Display name in Arabic
   */
  @Prop({ trim: true })
  nameAr?: string;

  /**
   * Display name in Farsi/Persian
   */
  @Prop({ trim: true })
  nameFa?: string;

  /**
   * Variant type for buy/sell differentiation
   */
  @Prop({ enum: ItemVariant })
  variant?: ItemVariant;

  /**
   * Item category (currency, crypto, gold)
   */
  @Prop({ required: true, enum: ItemCategory, index: true })
  category!: ItemCategory;

  /**
   * Icon identifier (e.g., "FaDollarSign" for React Icons)
   */
  @Prop({ trim: true })
  icon?: string;

  /**
   * Display order within category (lower = higher priority)
   */
  @Prop({ default: 999, index: true })
  displayOrder!: number;

  /**
   * Whether this item is visible to users
   */
  @Prop({ default: true, index: true })
  isActive!: boolean;

  // ==================== DATA SOURCE ====================

  /**
   * Source of price data (api or manual)
   */
  @Prop({ required: true, enum: ItemSource, default: ItemSource.API })
  source!: ItemSource;

  /**
   * Whether this item has data from external API
   */
  @Prop({ default: true })
  hasApiData!: boolean;

  // ==================== ADMIN OVERRIDE ====================

  /**
   * Whether admin has overridden the price
   */
  @Prop({ default: false })
  isOverridden!: boolean;

  /**
   * Admin-set override price (used instead of API price when isOverridden=true)
   */
  @Prop({ type: Number })
  overridePrice?: number;

  /**
   * Admin-set override change value
   */
  @Prop({ type: Number })
  overrideChange?: number;

  /**
   * Admin user ID who set the override
   */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  overrideBy?: Types.ObjectId;

  /**
   * Timestamp when override was set
   */
  @Prop({ type: Date })
  overrideAt?: Date;

  /**
   * Reason for the override (for audit)
   */
  @Prop({ trim: true })
  overrideReason?: string;

  // ==================== METADATA ====================

  /**
   * Last time API data was received for this item
   */
  @Prop({ type: Date })
  lastApiUpdate?: Date;

  /**
   * Additional metadata (flexible for future use)
   */
  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const ManagedItemSchema = SchemaFactory.createForClass(ManagedItem);

// ==================== INDEXES ====================

// Compound index for efficient category + active + order queries
ManagedItemSchema.index({ category: 1, isActive: 1, displayOrder: 1 });

// Index for parent code queries (grouping variants)
ManagedItemSchema.index({ parentCode: 1, isActive: 1 });

// Index for override tracking
ManagedItemSchema.index({ isOverridden: 1, overrideAt: -1 });

// Text index for search
ManagedItemSchema.index({ name: 'text', nameAr: 'text', nameFa: 'text' });
