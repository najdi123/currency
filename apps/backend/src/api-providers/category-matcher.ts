/**
 * PersianAPI Category Constants and Matching Logic
 * Provides type-safe category checking and categorization
 */

export enum PersianAPICategory {
  // Currency categories
  CURRENCY_FREE = "ارز آزاد",
  CURRENCY_OFFICIAL = "ارز دولتی",
  CURRENCY_SANA_BUY = "ارز سنا (اسکناس / خرید)",
  CURRENCY_SANA_SELL = "ارز سنا (اسکناس / فروش)",
  CURRENCY_NIMA_SELL = "ارز نیما (حواله / فروش)",

  // Gold categories
  GOLD = "طلا",
  GOLD_OUNCE = "انس های جهانی",

  // Coin categories
  COIN_CASH = "سکه نقدی",
  MESGHAL = "مظنه / مثقال",
  ABSHODEH = "آبشده",

  // Other
  SILVER = "نقره",
}

export interface CategorizedItem {
  type: "currency" | "gold" | "coin" | "unknown";
  item: any;
}

/**
 * Helper class to categorize items from PersianAPI
 * Uses normalized category matching with fallbacks
 */
export class CategoryMatcher {
  private readonly currencyCategories = [
    PersianAPICategory.CURRENCY_FREE,
    PersianAPICategory.CURRENCY_OFFICIAL,
    PersianAPICategory.CURRENCY_SANA_BUY,
    PersianAPICategory.CURRENCY_SANA_SELL,
    PersianAPICategory.CURRENCY_NIMA_SELL,
  ];

  private readonly goldCategories = [
    PersianAPICategory.GOLD,
    PersianAPICategory.GOLD_OUNCE,
  ];

  private readonly coinCategories = [
    PersianAPICategory.COIN_CASH,
    PersianAPICategory.MESGHAL,
    PersianAPICategory.ABSHODEH,
  ];

  /**
   * Check if item is a currency based on category
   */
  isCurrency(category: string | undefined): boolean {
    if (!category) return false;
    const normalized = category.trim();

    // Exact match
    if (this.currencyCategories.some((cat) => normalized === cat)) {
      return true;
    }

    // Partial match
    if (
      normalized.includes("ارز") ||
      normalized.toLowerCase().includes("currency")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Check if item is gold based on category
   */
  isGold(category: string | undefined): boolean {
    if (!category) return false;
    const normalized = category.trim();

    // Exact match
    if (this.goldCategories.some((cat) => normalized === cat)) {
      return true;
    }

    // Partial match
    if (
      normalized.includes("طلا") ||
      normalized.toLowerCase().includes("gold")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Check if item is a coin based on category
   */
  isCoin(category: string | undefined): boolean {
    if (!category) return false;
    const normalized = category.trim();

    // Exact match (consistent with isCurrency and isGold)
    if (this.coinCategories.some((cat) => normalized === cat)) {
      return true;
    }

    // Partial match as fallback
    if (
      normalized.includes("سکه") ||
      normalized.toLowerCase().includes("coin")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Categorize an array of items into currencies, gold, and coins
   */
  categorize(items: any[]): {
    currencies: any[];
    gold: any[];
    coins: any[];
  } {
    const currencies: any[] = [];
    const gold: any[] = [];
    const coins: any[] = [];

    for (const item of items) {
      const category = item.category || item.Category || "";

      if (this.isCurrency(category)) {
        currencies.push(item);
      } else if (this.isGold(category)) {
        gold.push(item);
      } else if (this.isCoin(category)) {
        coins.push(item);
      }
      // Items that don't match any category are ignored
    }

    return { currencies, gold, coins };
  }

  /**
   * Get the item type for a given category
   */
  getItemType(
    category: string | undefined,
  ): "currency" | "gold" | "coin" | "unknown" {
    if (this.isCurrency(category)) return "currency";
    if (this.isGold(category)) return "gold";
    if (this.isCoin(category)) return "coin";
    return "unknown";
  }
}
