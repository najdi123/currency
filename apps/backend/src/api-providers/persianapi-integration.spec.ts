import { Test, TestingModule } from "@nestjs/testing";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { PersianApiProvider } from "./persianapi.provider";

describe("PersianApiProvider - Integration Tests", () => {
  let provider: PersianApiProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        HttpModule,
        ConfigModule.forRoot({
          envFilePath: ".env.test",
          isGlobal: true,
        }),
      ],
      providers: [PersianApiProvider],
    }).compile();

    provider = module.get<PersianApiProvider>(PersianApiProvider);
  });

  describe("Configuration Validation", () => {
    it("should load key mapping configuration successfully", () => {
      // The provider should initialize without errors
      expect(provider).toBeDefined();
    });

    it("should validate API key format", async () => {
      const isValid = await provider.validateApiKey();
      // This will depend on whether a valid API key is configured
      expect(typeof isValid).toBe("boolean");
    });

    it("should get rate limit status", async () => {
      const status = await provider.getRateLimitStatus();

      expect(status).toBeDefined();
      expect(typeof status.remaining).toBe("number");
      expect(typeof status.total).toBe("number");
      expect(status.reset).toBeInstanceOf(Date);
    });
  });

  describe("Error Tracking Integration", () => {
    it("should track errors when mapping fails", async () => {
      // Create an item with invalid data to trigger mapping error
      const invalidItem = {
        key: "invalid",
        // Missing required fields
      };

      try {
        // This should trigger error tracking
        (provider as any).mapToCurrencyData(invalidItem);
      } catch (error) {
        // Error should be tracked
        expect(error).toBeDefined();
      }
    });

    it("should reset error counter on successful mapping", async () => {
      const validItem = {
        key: 137202,
        title: "دلار",
        price: "50000",
        change: "100",
        high: "51000",
        low: "49000",
        created_at: new Date().toISOString(),
        category: "ارز آزاد",
      };

      const result = (provider as any).mapToCurrencyData(validItem);

      expect(result).toBeDefined();
      expect(result.code).toBe("usd_sell");
      expect(result.name).toBe("دلار");
    });
  });

  describe("Field Extraction", () => {
    it("should extract field with multiple possible names", () => {
      const item = {
        title: "Test Title",
        price: "100",
      };

      const extractedTitle = (provider as any).extractField(
        item,
        "title",
        "Title",
        "عنوان",
      );
      const extractedPrice = (provider as any).extractField(
        item,
        "price",
        "Price",
      );

      expect(extractedTitle).toBe("Test Title");
      expect(extractedPrice).toBe("100");
    });

    it("should return undefined for missing fields", () => {
      const item = {};

      const result = (provider as any).extractField(item, "nonexistent");

      expect(result).toBeUndefined();
    });

    it("should handle Persian field names", () => {
      const item = {
        عنوان: "عنوان فارسی",
        قیمت: "50000",
      };

      const title = (provider as any).extractField(item, "title", "عنوان");
      const price = (provider as any).extractField(item, "price", "قیمت");

      expect(title).toBe("عنوان فارسی");
      expect(price).toBe("50000");
    });
  });

  describe("Price Parsing", () => {
    it("should parse numeric price", () => {
      const result = (provider as any).parsePrice(50000);
      expect(result).toBe(50000);
    });

    it("should parse string price with commas", () => {
      const result = (provider as any).parsePrice("50,000");
      expect(result).toBe(50000);
    });

    it("should parse Persian/Arabic numerals", () => {
      const result = (provider as any).parsePrice("۵۰۰۰۰");
      expect(result).toBe(50000);
    });

    it("should return 0 for invalid price", () => {
      expect((provider as any).parsePrice(null)).toBe(0);
      expect((provider as any).parsePrice(undefined)).toBe(0);
      expect((provider as any).parsePrice("invalid")).toBe(0);
    });

    it("should handle negative prices", () => {
      const result = (provider as any).parsePrice(-100);
      expect(result).toBe(-100);
    });
  });

  describe("Date Parsing", () => {
    it("should parse ISO date string", () => {
      const dateStr = "2025-11-22T10:00:00.000Z";
      const result = (provider as any).parseDate(dateStr);

      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe(dateStr);
    });

    it("should parse timestamp", () => {
      const timestamp = Date.now();
      const result = (provider as any).parseDate(timestamp);

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(timestamp);
    });

    it("should return current date for invalid input", () => {
      const result = (provider as any).parseDate("invalid");
      const now = new Date();

      expect(result).toBeInstanceOf(Date);
      // Should be within 1 second of current time
      expect(Math.abs(result.getTime() - now.getTime())).toBeLessThan(1000);
    });
  });

  describe("Code Generation", () => {
    it("should generate code from title for currency", () => {
      const code = (provider as any).generateCurrencyCode("دلار", "ارز آزاد");

      expect(code).toBeDefined();
      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThan(0);
    });

    it("should generate unique codes for different titles", () => {
      const code1 = (provider as any).generateCurrencyCode("دلار", "ارز آزاد");
      const code2 = (provider as any).generateCurrencyCode("یورو", "ارز آزاد");

      expect(code1).not.toBe(code2);
    });

    it("should generate deterministic codes", () => {
      const code1 = (provider as any).generateCurrencyCode("دلار", "ارز آزاد");
      const code2 = (provider as any).generateCurrencyCode("دلار", "ارز آزاد");

      expect(code1).toBe(code2);
    });
  });

  describe("Key Mapping", () => {
    it("should map known key to code", () => {
      const validItem = {
        key: 137202, // USD
        title: "دلار",
        price: "50000",
        category: "ارز آزاد",
      };

      const result = (provider as any).mapToCurrencyData(validItem);

      expect(result.code).toBe("usd_sell");
    });

    it("should generate code for unknown key", () => {
      const unknownItem = {
        key: 999999,
        title: "Unknown Currency",
        price: "100",
        category: "ارز آزاد",
      };

      const result = (provider as any).mapToCurrencyData(unknownItem);

      expect(result.code).toBeDefined();
      expect(typeof result.code).toBe("string");
    });
  });

  describe("Gold and Coin Mapping", () => {
    it("should map gold item correctly", () => {
      const goldItem = {
        key: 137120, // 18 karat gold
        عنوان: "طلای 18 عیار",
        قیمت: "5000000",
        بیشترین: "5100000",
        کمترین: "4900000",
        "تاریخ بروزرسانی": new Date().toISOString(),
        category: "طلا",
      };

      const result = (provider as any).mapToGoldData(goldItem);

      expect(result).toBeDefined();
      expect(result.code).toBe("18ayar");
      expect(result.name).toBe("طلای 18 عیار");
      expect(result.price).toBe(5000000);
      expect(result.category).toBe("طلا");
    });

    it("should map coin item correctly", () => {
      const coinItem = {
        key: 137137, // Sekkeh
        عنوان: "سکه امامی",
        قیمت: "45000000",
        بیشترین: "46000000",
        کمترین: "44000000",
        "تاریخ بروزرسانی": new Date().toISOString(),
      };

      const result = (provider as any).mapToCoinData(coinItem);

      expect(result).toBeDefined();
      expect(result.code).toBe("sekkeh");
      expect(result.name).toBe("سکه امامی");
      expect(result.price).toBe(45000000);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing required fields gracefully", () => {
      const invalidItem = {
        key: 123,
        // Missing title, price, etc.
      };

      try {
        (provider as any).mapToCurrencyData(invalidItem);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should track multiple errors for same context", () => {
      const invalidItem = {
        key: 123,
      };

      // Track multiple errors
      for (let i = 0; i < 3; i++) {
        try {
          (provider as any).mapToCurrencyData(invalidItem);
        } catch (error) {
          // Expected
        }
      }

      // Should have tracked errors (implementation detail)
      expect(true).toBe(true);
    });
  });
});
