import { Injectable, Logger, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import {
  ItemCategory,
  VALID_CATEGORIES,
  CATEGORY_ITEMS,
  CATEGORY_ITEM_CODES,
  GOLD_MULTIPLIER_ITEMS,
} from '../constants/market-data.constants';
import { MarketDataValidationService } from './market-data-validation.service';

/**
 * MarketDataCategoryService
 *
 * Responsible for category management and item code mapping
 * - Maps categories to item codes
 * - Determines category from item strings
 * - Provides category-specific configurations
 *
 * Note: Input validation is delegated to MarketDataValidationService
 */
@Injectable()
export class MarketDataCategoryService {
  private readonly logger = new Logger(MarketDataCategoryService.name);

  constructor(
    @Inject(forwardRef(() => MarketDataValidationService))
    private readonly validationService: MarketDataValidationService,
  ) {}

  /**
   * Validate category parameter
   * Delegates to ValidationService for security checks
   *
   * @throws BadRequestException if category is invalid
   */
  validateCategory(category: string): void {
    this.validationService.validateCategory(category);
  }

  /**
   * Check if category is a valid known category
   */
  isValidCategory(category: string): category is ItemCategory {
    return VALID_CATEGORIES.includes(category as ItemCategory);
  }

  /**
   * Get items string for a category (for API requests)
   * Returns comma-separated lowercase item codes
   */
  getItemsForCategory(category: ItemCategory): string {
    this.validateCategory(category);

    const items = CATEGORY_ITEMS[category];
    if (!items) {
      throw new BadRequestException(`Unknown category: ${category}`);
    }

    return items;
  }

  /**
   * Get item codes for a category (UPPERCASE for database queries)
   * Returns array of item codes used in ohlc_permanent collection
   */
  getCategoryItemCodes(category: string): string[] {
    const normalizedCategory = category.toLowerCase();

    switch (normalizedCategory) {
      case 'currencies':
        return [...CATEGORY_ITEM_CODES.currencies];
      case 'crypto':
        return [...CATEGORY_ITEM_CODES.crypto];
      case 'gold':
        return [...CATEGORY_ITEM_CODES.gold];
      case 'coins':
        return [...CATEGORY_ITEM_CODES.coins];
      case 'all':
        return [
          ...CATEGORY_ITEM_CODES.currencies,
          ...CATEGORY_ITEM_CODES.crypto,
          ...CATEGORY_ITEM_CODES.gold,
        ];
      default:
        throw new BadRequestException(`Invalid category: ${category}`);
    }
  }

  /**
   * Determine category from items string using exact matching first,
   * then fallback to contains check
   */
  determineCategoryFromItemsString(
    items: string,
  ): 'currencies' | 'crypto' | 'gold' | 'all' {
    // Exact match first (most reliable)
    if (items === CATEGORY_ITEMS.all) {
      return 'all';
    }
    if (items === CATEGORY_ITEMS.currencies) {
      return 'currencies';
    }
    if (items === CATEGORY_ITEMS.crypto) {
      return 'crypto';
    }
    if (items === CATEGORY_ITEMS.gold) {
      return 'gold';
    }

    // Fallback to contains check for partial matches
    // Check for crypto first (most specific keywords)
    if (
      items.includes('btc') ||
      items.includes('eth') ||
      items.includes('usdt')
    ) {
      this.logger.debug('Category detected via contains check: crypto');
      return 'crypto';
    }

    // Check for gold
    if (
      items.includes('sekkeh') ||
      items.includes('bahar') ||
      items.includes('18ayar')
    ) {
      this.logger.debug('Category detected via contains check: gold');
      return 'gold';
    }

    // Check for currencies (least specific, so last)
    if (
      items.includes('usd') ||
      items.includes('eur') ||
      items.includes('gbp')
    ) {
      this.logger.debug('Category detected via contains check: currencies');
      return 'currencies';
    }

    // Default to currencies if no match found
    this.logger.warn(
      `Could not determine category for items: ${items.substring(0, 50)}..., defaulting to currencies`,
    );
    return 'currencies';
  }

  /**
   * Check if an item code needs gold multiplier
   * Gold coins (sekkeh, bahar, nim, rob, gerami) are stored in thousands
   */
  needsGoldMultiplier(itemCode: string): boolean {
    return GOLD_MULTIPLIER_ITEMS.includes(
      itemCode.toLowerCase() as typeof GOLD_MULTIPLIER_ITEMS[number],
    );
  }

  /**
   * Get all gold items that need multiplier
   */
  getGoldMultiplierItems(): readonly string[] {
    return GOLD_MULTIPLIER_ITEMS;
  }

  /**
   * Get all valid categories
   */
  getAllCategories(): readonly string[] {
    return VALID_CATEGORIES;
  }

  /**
   * Get category display name
   */
  getCategoryDisplayName(category: ItemCategory): string {
    const displayNames: Record<ItemCategory, string> = {
      all: 'All Markets',
      currencies: 'Currencies',
      crypto: 'Cryptocurrencies',
      gold: 'Gold & Coins',
      coins: 'Gold Coins',
    };

    return displayNames[category] || category;
  }
}
