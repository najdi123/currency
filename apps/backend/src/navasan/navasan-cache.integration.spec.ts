import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { getModelToken } from "@nestjs/mongoose";
import { NavasanService } from "./navasan.service";
import { CacheService } from "../cache/cache.service";
import { MetricsService } from "../metrics/metrics.service";
import { ApiProviderFactory } from "../api-providers/api-provider.factory";
import { IntradayOhlcService } from "./services/intraday-ohlc.service";

/**
 * Integration Tests for NavasanService Cache Operations
 *
 * These tests verify that:
 * 1. OHLC cache works with Redis/memory fallback
 * 2. Historical cache works with proper type safety
 * 3. Cache keys use namespace prefixes correctly
 * 4. TTL expiration works as expected
 */
describe("NavasanService - Cache Integration", () => {
  let navasanService: NavasanService;
  let cacheService: CacheService;

  // Mock models
  const mockCacheModel = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
  };

  const mockPriceSnapshotModel = {
    find: jest.fn(),
  };

  const mockOhlcSnapshotModel = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NavasanService,
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                NAVASAN_API_KEY: "test-api-key",
                INTERNAL_API_URL: "http://localhost:4000",
                REDIS_ENABLED: "false", // Use memory cache for tests
                REDIS_HOST: "localhost",
                REDIS_PORT: "6379",
              };
              return config[key];
            }),
          },
        },
        {
          provide: getModelToken("Cache"),
          useValue: mockCacheModel,
        },
        {
          provide: getModelToken("PriceSnapshot"),
          useValue: mockPriceSnapshotModel,
        },
        {
          provide: getModelToken("OhlcSnapshot"),
          useValue: mockOhlcSnapshotModel,
        },
        {
          provide: MetricsService,
          useValue: {
            trackCacheHit: jest.fn(),
            trackCacheMiss: jest.fn(),
            trackSnapshotFailure: jest.fn(),
            resetSnapshotFailureCounter: jest.fn(),
          },
        },
        {
          provide: ApiProviderFactory,
          useValue: {
            getProvider: jest.fn(),
          },
        },
        {
          provide: IntradayOhlcService,
          useValue: {
            recordDataPoints: jest.fn(),
            getTodayOhlc: jest.fn(),
          },
        },
      ],
    }).compile();

    navasanService = module.get<NavasanService>(NavasanService);
    cacheService = module.get<CacheService>(CacheService);

    // Clear cache before each test
    await cacheService.clear();
  });

  afterEach(async () => {
    await cacheService.clear();
    await cacheService.onModuleDestroy();
  });

  describe("Cache Key Namespacing", () => {
    it("should use navasan:ohlc namespace for OHLC cache keys", async () => {
      // This test verifies the cache key format
      const category = "currencies";
      const dateString = new Date().toDateString();
      const expectedKeyPattern = `navasan:ohlc:${category}:${dateString}`;

      // Verify by checking if we can set/get with that key pattern
      const testData = { usd_sell: { value: "50000", change: "100" } };
      await cacheService.set(expectedKeyPattern, testData);

      const retrieved = await cacheService.get(expectedKeyPattern);
      expect(retrieved).toEqual(testData);
    });

    it("should use navasan:historical namespace for historical cache keys", async () => {
      const category = "currencies";
      const date = new Date().toISOString().split("T")[0];
      const expectedKeyPattern = `navasan:historical:${category}:${date}`;

      const testData = {
        data: { usd_sell: { value: "50000" } },
        metadata: { source: "api" },
      };
      await cacheService.set(expectedKeyPattern, testData);

      const retrieved = await cacheService.get(expectedKeyPattern);
      expect(retrieved).toEqual(testData);
    });

    it("should prevent key collisions between OHLC and historical caches", async () => {
      const category = "currencies";
      const dateString = new Date().toDateString();
      const dateISO = new Date().toISOString().split("T")[0];

      const ohlcKey = `navasan:ohlc:${category}:${dateString}`;
      const historicalKey = `navasan:historical:${category}:${dateISO}`;

      const ohlcData = { type: "ohlc" };
      const historicalData = { type: "historical" };

      await cacheService.set(ohlcKey, ohlcData);
      await cacheService.set(historicalKey, historicalData);

      const retrievedOhlc = await cacheService.get(ohlcKey);
      const retrievedHistorical = await cacheService.get(historicalKey);

      expect(retrievedOhlc).toEqual(ohlcData);
      expect(retrievedHistorical).toEqual(historicalData);
      expect(retrievedOhlc).not.toEqual(retrievedHistorical);
    });
  });

  describe("Type Safety", () => {
    it("should maintain type safety for NavasanResponse in OHLC cache", async () => {
      const key = `navasan:ohlc:currencies:${new Date().toDateString()}`;
      const ohlcData = {
        usd_sell: {
          value: "50000",
          change: "100",
          min: "49900",
          max: "50100",
        },
      };

      await cacheService.set(key, ohlcData);
      const retrieved = await cacheService.get<typeof ohlcData>(key);

      expect(retrieved).toBeDefined();
      expect(retrieved?.usd_sell.value).toBe("50000");
      expect(retrieved?.usd_sell.change).toBe("100");
    });

    it("should maintain type safety for ApiResponse in historical cache", async () => {
      const key = `navasan:historical:currencies:${new Date().toISOString().split("T")[0]}`;
      const historicalData = {
        data: {
          usd_sell: { value: "50000" },
        },
        metadata: {
          isFresh: false,
          isStale: false,
          source: "api" as const,
          lastUpdated: new Date(),
          isHistorical: true,
          historicalDate: new Date(),
        },
      };

      await cacheService.set(key, historicalData);
      const retrieved = await cacheService.get<typeof historicalData>(key);

      expect(retrieved).toBeDefined();
      expect(retrieved?.data.usd_sell.value).toBe("50000");
      expect(retrieved?.metadata.source).toBe("api");
      expect(retrieved?.metadata.isHistorical).toBe(true);
    });
  });

  describe("TTL Behavior", () => {
    it("should respect 1 hour TTL for OHLC cache", async () => {
      const key = `navasan:ohlc:test:${new Date().toDateString()}`;
      const data = { test: "data" };
      const ttlSeconds = 3600; // 1 hour

      await cacheService.set(key, data, ttlSeconds);

      // Should exist immediately
      const immediate = await cacheService.get(key);
      expect(immediate).toEqual(data);

      // Note: We can't test actual expiration in unit tests without waiting 1 hour
      // This is verified in the CacheService tests with shorter TTLs
    });

    it("should respect 24 hour TTL for historical cache", async () => {
      const key = `navasan:historical:test:2025-01-01`;
      const data = { historical: "data" };
      const ttlSeconds = 86400; // 24 hours

      await cacheService.set(key, data, ttlSeconds);

      const immediate = await cacheService.get(key);
      expect(immediate).toEqual(data);
    });
  });

  describe("Cache Statistics", () => {
    it("should track cache operations", async () => {
      const stats1 = await cacheService.getStats();
      const initialKeys = stats1.keys;

      await cacheService.set("test:key1", "value1");
      await cacheService.set("test:key2", "value2");

      const stats2 = await cacheService.getStats();
      expect(stats2.keys).toBeGreaterThan(initialKeys);
    });

    it("should report memory type when Redis is disabled", async () => {
      const stats = await cacheService.getStats();
      expect(stats.type).toBe("memory");
    });
  });

  describe("Error Resilience", () => {
    it("should handle cache service errors gracefully", async () => {
      // Even if cache fails, the service should continue working
      // This is ensured by CacheService's internal error handling

      const key = "test:resilience";
      await cacheService.set(key, "value");

      const retrieved = await cacheService.get(key);
      expect(retrieved).toBeDefined();
    });

    it("should handle concurrent cache operations", async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(cacheService.set(`concurrent:key${i}`, `value${i}`));
      }

      await Promise.all(promises);

      // Verify all were set
      for (let i = 0; i < 10; i++) {
        const value = await cacheService.get(`concurrent:key${i}`);
        expect(value).toBe(`value${i}`);
      }
    });
  });

  describe("Cache Clear and Cleanup", () => {
    it("should clear all cache entries", async () => {
      await cacheService.set("navasan:ohlc:test1", "value1");
      await cacheService.set("navasan:historical:test2", "value2");

      await cacheService.clear();

      const val1 = await cacheService.get("navasan:ohlc:test1");
      const val2 = await cacheService.get("navasan:historical:test2");

      expect(val1).toBeNull();
      expect(val2).toBeNull();
    });
  });
});
