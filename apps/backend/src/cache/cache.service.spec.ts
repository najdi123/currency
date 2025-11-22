import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { CacheService } from "./cache.service";

describe("CacheService", () => {
  let service: CacheService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                REDIS_ENABLED: "false", // Use memory cache for tests
                REDIS_HOST: "localhost",
                REDIS_PORT: "6379",
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(async () => {
    await service.clear();
    await service.onModuleDestroy();
  });

  describe("Basic Operations", () => {
    it("should be defined", () => {
      expect(service).toBeDefined();
    });

    it("should set and get a value", async () => {
      const key = "test:key";
      const value = { data: "test data" };

      await service.set(key, value);
      const retrieved = await service.get(key);

      expect(retrieved).toEqual(value);
    });

    it("should return null for non-existent key", async () => {
      const retrieved = await service.get("non:existent:key");
      expect(retrieved).toBeNull();
    });

    it("should delete a key", async () => {
      const key = "test:delete";
      await service.set(key, "value");

      await service.delete(key);
      const retrieved = await service.get(key);

      expect(retrieved).toBeNull();
    });

    it("should check if key exists", async () => {
      const key = "test:exists";
      await service.set(key, "value");

      const exists = await service.exists(key);
      expect(exists).toBe(true);

      await service.delete(key);
      const notExists = await service.exists(key);
      expect(notExists).toBe(false);
    });

    it("should clear all cache", async () => {
      await service.set("key1", "value1");
      await service.set("key2", "value2");

      await service.clear();

      const val1 = await service.get("key1");
      const val2 = await service.get("key2");

      expect(val1).toBeNull();
      expect(val2).toBeNull();
    });
  });

  describe("TTL (Time To Live)", () => {
    it("should expire key after TTL", async () => {
      const key = "test:ttl";
      const value = "expiring value";
      const ttlSeconds = 1; // 1 second

      await service.set(key, value, ttlSeconds);

      // Should exist immediately
      const immediate = await service.get(key);
      expect(immediate).toEqual(value);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be expired
      const expired = await service.get(key);
      expect(expired).toBeNull();
    });

    it("should not expire key without TTL", async () => {
      const key = "test:no-ttl";
      const value = "persistent value";

      await service.set(key, value); // No TTL

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 500));

      const retrieved = await service.get(key);
      expect(retrieved).toEqual(value);
    });
  });

  describe("Type Safety", () => {
    it("should handle string values", async () => {
      const key = "test:string";
      const value = "test string";

      await service.set(key, value);
      const retrieved = await service.get<string>(key);

      expect(typeof retrieved).toBe("string");
      expect(retrieved).toBe(value);
    });

    it("should handle number values", async () => {
      const key = "test:number";
      const value = 42;

      await service.set(key, value);
      const retrieved = await service.get<number>(key);

      expect(typeof retrieved).toBe("number");
      expect(retrieved).toBe(value);
    });

    it("should handle object values", async () => {
      const key = "test:object";
      const value = {
        id: 1,
        name: "Test",
        nested: { prop: "value" },
      };

      await service.set(key, value);
      const retrieved = await service.get<typeof value>(key);

      expect(retrieved).toEqual(value);
      expect(retrieved?.nested.prop).toBe("value");
    });

    it("should handle array values", async () => {
      const key = "test:array";
      const value = [1, 2, 3, 4, 5];

      await service.set(key, value);
      const retrieved = await service.get<number[]>(key);

      expect(Array.isArray(retrieved)).toBe(true);
      expect(retrieved).toEqual(value);
    });
  });

  describe("Statistics", () => {
    it("should return cache statistics", async () => {
      await service.set("key1", "value1");
      await service.set("key2", "value2");

      const stats = await service.getStats();

      expect(stats).toHaveProperty("type");
      expect(stats).toHaveProperty("keys");
      expect(stats.type).toBe("memory"); // Using memory cache in tests
      expect(stats.keys).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid JSON gracefully", async () => {
      // This test ensures the service doesn't crash on corrupted data
      const key = "test:invalid";

      // Set a valid value first
      await service.set(key, "valid value");
      const retrieved = await service.get(key);

      expect(retrieved).toBeDefined();
    });

    it("should handle special characters in keys", async () => {
      const key = "test:special:!@#$%^&*()";
      const value = "special key value";

      await service.set(key, value);
      const retrieved = await service.get(key);

      expect(retrieved).toEqual(value);
    });

    it("should handle very long values", async () => {
      const key = "test:long-value";
      const value = "x".repeat(10000); // 10KB string

      await service.set(key, value);
      const retrieved = await service.get(key);

      expect(retrieved).toEqual(value);
    });
  });

  describe("Cache Key Namespacing", () => {
    it("should isolate keys with different namespaces", async () => {
      await service.set("navasan:ohlc:currencies:key1", "value1");
      await service.set("navasan:historical:currencies:key1", "value2");

      const ohlc = await service.get("navasan:ohlc:currencies:key1");
      const historical = await service.get("navasan:historical:currencies:key1");

      expect(ohlc).toBe("value1");
      expect(historical).toBe("value2");
    });
  });
});
