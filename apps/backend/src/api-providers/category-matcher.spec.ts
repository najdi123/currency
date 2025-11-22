import { CategoryMatcher, PersianAPICategory } from './category-matcher';

describe('CategoryMatcher', () => {
  let matcher: CategoryMatcher;

  beforeEach(() => {
    matcher = new CategoryMatcher();
  });

  describe('isCurrency', () => {
    it('should return true for exact currency category match', () => {
      expect(matcher.isCurrency(PersianAPICategory.CURRENCY_FREE)).toBe(true);
      expect(matcher.isCurrency(PersianAPICategory.CURRENCY_OFFICIAL)).toBe(true);
      expect(matcher.isCurrency(PersianAPICategory.CURRENCY_SANA_BUY)).toBe(true);
      expect(matcher.isCurrency(PersianAPICategory.CURRENCY_SANA_SELL)).toBe(true);
      expect(matcher.isCurrency(PersianAPICategory.CURRENCY_NIMA_SELL)).toBe(true);
    });

    it('should return true for partial match with "ارز"', () => {
      expect(matcher.isCurrency('ارز جدید')).toBe(true);
      expect(matcher.isCurrency('قیمت ارز')).toBe(true);
    });

    it('should return true for partial match with "currency"', () => {
      expect(matcher.isCurrency('currency rates')).toBe(true);
      expect(matcher.isCurrency('Digital Currency')).toBe(true);
    });

    it('should return false for non-currency categories', () => {
      expect(matcher.isCurrency(PersianAPICategory.GOLD)).toBe(false);
      expect(matcher.isCurrency(PersianAPICategory.COIN_CASH)).toBe(false);
      expect(matcher.isCurrency('سکه')).toBe(false);
      expect(matcher.isCurrency(undefined)).toBe(false);
    });

    it('should handle whitespace correctly', () => {
      expect(matcher.isCurrency('  ارز آزاد  ')).toBe(true);
    });
  });

  describe('isGold', () => {
    it('should return true for exact gold category match', () => {
      expect(matcher.isGold(PersianAPICategory.GOLD)).toBe(true);
      expect(matcher.isGold(PersianAPICategory.GOLD_OUNCE)).toBe(true);
    });

    it('should return true for partial match with "طلا"', () => {
      expect(matcher.isGold('طلای جدید')).toBe(true);
      expect(matcher.isGold('قیمت طلا')).toBe(true);
    });

    it('should return true for partial match with "gold"', () => {
      expect(matcher.isGold('gold rates')).toBe(true);
      expect(matcher.isGold('Gold Price')).toBe(true);
    });

    it('should return false for non-gold categories', () => {
      expect(matcher.isGold(PersianAPICategory.CURRENCY_FREE)).toBe(false);
      expect(matcher.isGold(PersianAPICategory.COIN_CASH)).toBe(false);
      expect(matcher.isGold('سکه')).toBe(false);
      expect(matcher.isGold(undefined)).toBe(false);
    });

    it('should handle whitespace correctly', () => {
      expect(matcher.isGold('  طلا  ')).toBe(true);
    });
  });

  describe('isCoin', () => {
    it('should return true for exact coin category match', () => {
      expect(matcher.isCoin(PersianAPICategory.COIN_CASH)).toBe(true);
      expect(matcher.isCoin(PersianAPICategory.MESGHAL)).toBe(true);
      expect(matcher.isCoin(PersianAPICategory.ABSHODEH)).toBe(true);
    });

    it('should return true for partial match with "سکه"', () => {
      expect(matcher.isCoin('سکه جدید')).toBe(true);
      expect(matcher.isCoin('قیمت سکه')).toBe(true);
    });

    it('should return true for partial match with "coin"', () => {
      expect(matcher.isCoin('coin rates')).toBe(true);
      expect(matcher.isCoin('Coin Price')).toBe(true);
    });

    it('should return false for non-coin categories', () => {
      expect(matcher.isCoin(PersianAPICategory.CURRENCY_FREE)).toBe(false);
      expect(matcher.isCoin(PersianAPICategory.GOLD)).toBe(false);
      expect(matcher.isCoin('طلا')).toBe(false);
      expect(matcher.isCoin(undefined)).toBe(false);
    });

    it('should handle whitespace correctly', () => {
      expect(matcher.isCoin('  سکه نقدی  ')).toBe(true);
    });

    it('should use exact match first (consistency fix)', () => {
      // This tests the bug fix - should use === first like isCurrency and isGold
      expect(matcher.isCoin(PersianAPICategory.COIN_CASH)).toBe(true);
      expect(matcher.isCoin('سکه نقدی')).toBe(true);
    });
  });

  describe('categorize', () => {
    it('should categorize items correctly', () => {
      const items = [
        { category: PersianAPICategory.CURRENCY_FREE, name: 'USD' },
        { category: PersianAPICategory.GOLD, name: 'Gold 18k' },
        { category: PersianAPICategory.COIN_CASH, name: 'Coin' },
        { category: 'Unknown Category', name: 'Unknown' },
      ];

      const result = matcher.categorize(items);

      expect(result.currencies).toHaveLength(1);
      expect(result.gold).toHaveLength(1);
      expect(result.coins).toHaveLength(1);
      expect(result.currencies[0].name).toBe('USD');
      expect(result.gold[0].name).toBe('Gold 18k');
      expect(result.coins[0].name).toBe('Coin');
    });

    it('should handle items with capitalized Category field', () => {
      const items = [
        { Category: PersianAPICategory.CURRENCY_FREE, name: 'USD' },
      ];

      const result = matcher.categorize(items);

      expect(result.currencies).toHaveLength(1);
    });

    it('should ignore items without category', () => {
      const items = [
        { name: 'No Category Item' },
      ];

      const result = matcher.categorize(items);

      expect(result.currencies).toHaveLength(0);
      expect(result.gold).toHaveLength(0);
      expect(result.coins).toHaveLength(0);
    });

    it('should return empty arrays for empty input', () => {
      const result = matcher.categorize([]);

      expect(result.currencies).toEqual([]);
      expect(result.gold).toEqual([]);
      expect(result.coins).toEqual([]);
    });

    it('should handle mixed categories with partial matches', () => {
      const items = [
        { category: 'ارز جدید', name: 'Item 1' },
        { category: 'gold price', name: 'Item 2' },
        { category: 'coin market', name: 'Item 3' },
      ];

      const result = matcher.categorize(items);

      expect(result.currencies).toHaveLength(1);
      expect(result.gold).toHaveLength(1);
      expect(result.coins).toHaveLength(1);
    });
  });

  describe('getItemType', () => {
    it('should return "currency" for currency categories', () => {
      expect(matcher.getItemType(PersianAPICategory.CURRENCY_FREE)).toBe('currency');
      expect(matcher.getItemType('ارز آزاد')).toBe('currency');
    });

    it('should return "gold" for gold categories', () => {
      expect(matcher.getItemType(PersianAPICategory.GOLD)).toBe('gold');
      expect(matcher.getItemType('طلا')).toBe('gold');
    });

    it('should return "coin" for coin categories', () => {
      expect(matcher.getItemType(PersianAPICategory.COIN_CASH)).toBe('coin');
      expect(matcher.getItemType('سکه')).toBe('coin');
    });

    it('should return "unknown" for unrecognized categories', () => {
      expect(matcher.getItemType('Unknown')).toBe('unknown');
      expect(matcher.getItemType(undefined)).toBe('unknown');
      expect(matcher.getItemType('')).toBe('unknown');
    });

    it('should prioritize exact matches over partial matches', () => {
      // Currency should be checked first
      expect(matcher.getItemType(PersianAPICategory.CURRENCY_FREE)).toBe('currency');
      // Then gold
      expect(matcher.getItemType(PersianAPICategory.GOLD)).toBe('gold');
      // Then coin
      expect(matcher.getItemType(PersianAPICategory.COIN_CASH)).toBe('coin');
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      expect(matcher.isCurrency('')).toBe(false);
      expect(matcher.isGold('')).toBe(false);
      expect(matcher.isCoin('')).toBe(false);
    });

    it('should handle only whitespace', () => {
      expect(matcher.isCurrency('   ')).toBe(false);
      expect(matcher.isGold('   ')).toBe(false);
      expect(matcher.isCoin('   ')).toBe(false);
    });

    it('should be case-sensitive for Persian text', () => {
      // Persian doesn't have case, but test that it works correctly
      expect(matcher.isCurrency('ارز')).toBe(true);
    });

    it('should be case-insensitive for English text', () => {
      expect(matcher.isCurrency('CURRENCY')).toBe(true);
      expect(matcher.isCurrency('Currency')).toBe(true);
      expect(matcher.isCurrency('currency')).toBe(true);
    });
  });
});
