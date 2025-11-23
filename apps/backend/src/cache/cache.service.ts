import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private readonly useRedis: boolean;
  private memoryCache = new Map<string, { value: string; expiry: number }>();
  private cleanupInterval: NodeJS.Timeout;

  // Metrics tracking
  private metrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    hitsByNamespace: new Map<string, number>(),
    missesByNamespace: new Map<string, number>(),
  };

  constructor(private readonly configService: ConfigService) {
    const redisEnabled =
      this.configService.get<string>("REDIS_ENABLED") !== "false";
    const redisHost =
      this.configService.get<string>("REDIS_HOST") || "localhost";
    const redisPort = this.configService.get<number>("REDIS_PORT") || 6379;
    const redisPassword = this.configService.get<string>("REDIS_PASSWORD");

    this.useRedis = redisEnabled;

    if (this.useRedis) {
      try {
        this.redis = new Redis({
          host: redisHost,
          port: redisPort,
          password: redisPassword || undefined,
          retryStrategy: (times: number): number | null => {
            if (times > 5) {
              this.logger.error(
                "Redis connection failed after 5 retries, falling back to memory cache",
              );
              return null;
            }
            const delay = Math.min(times * 100, 3000);
            this.logger.warn(
              `Redis retry attempt ${times}, waiting ${delay}ms`,
            );
            return delay;
          },
          maxRetriesPerRequest: 3,
        });

        this.redis.on("connect", () => {
          this.logger.log("Redis connected successfully");
        });

        this.redis.on("error", (error: Error) => {
          this.logger.error(`Redis error: ${error.message}`);
        });

        this.logger.log(`Redis cache enabled: ${redisHost}:${redisPort}`);
      } catch (error) {
        const err = error as Error;
        this.logger.error(`Failed to initialize Redis: ${err.message}`);
        this.redis = null;
      }
    } else {
      this.logger.warn("Redis disabled, using in-memory cache only");
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredMemoryCache();
    }, 60000);
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (this.redis) {
        if (ttlSeconds) {
          await this.redis.setex(key, ttlSeconds, serialized);
        } else {
          await this.redis.set(key, serialized);
        }
      } else {
        const expiry = ttlSeconds
          ? Date.now() + ttlSeconds * 1000
          : Number.MAX_SAFE_INTEGER;
        this.memoryCache.set(key, { value: serialized, expiry });
      }
      this.metrics.sets++;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to set cache key "${key}": ${err.message}`);
      this.metrics.errors++;
      const expiry = ttlSeconds
        ? Date.now() + ttlSeconds * 1000
        : Number.MAX_SAFE_INTEGER;
      this.memoryCache.set(key, { value: JSON.stringify(value), expiry });
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      let serialized: string | null = null;
      if (this.redis) {
        serialized = await this.redis.get(key);
      } else {
        const cached = this.memoryCache.get(key);
        if (cached) {
          if (cached.expiry < Date.now()) {
            this.memoryCache.delete(key);
            this.metrics.misses++;
            this.trackNamespaceMetric(key, "miss");
            return null;
          }
          serialized = cached.value;
        }
      }
      if (serialized === null) {
        this.metrics.misses++;
        this.trackNamespaceMetric(key, "miss");
        return null;
      }
      this.metrics.hits++;
      this.trackNamespaceMetric(key, "hit");
      return JSON.parse(serialized) as T;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to get cache key "${key}": ${err.message}`);
      this.metrics.errors++;
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.del(key);
      } else {
        this.memoryCache.delete(key);
      }
      this.metrics.deletes++;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to delete cache key "${key}": ${err.message}`);
      this.metrics.errors++;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (this.redis) {
        const result = await this.redis.exists(key);
        return result === 1;
      } else {
        const cached = this.memoryCache.get(key);
        if (!cached) return false;
        if (cached.expiry < Date.now()) {
          this.memoryCache.delete(key);
          return false;
        }
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.flushdb();
        this.logger.log("Redis cache cleared");
      } else {
        this.memoryCache.clear();
        this.logger.log("Memory cache cleared");
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to clear cache: ${err.message}`);
    }
  }

  async getStats(): Promise<{
    type: "redis" | "memory";
    keys: number;
    memoryUsage?: string;
  }> {
    try {
      if (this.redis) {
        const dbSize = await this.redis.dbsize();
        const info = await this.redis.info("memory");
        const memoryMatch = info.match(/used_memory_human:(.+)/);
        const memoryUsage = memoryMatch ? memoryMatch[1].trim() : "unknown";
        return {
          type: "redis",
          keys: dbSize,
          memoryUsage,
        };
      } else {
        return {
          type: "memory",
          keys: this.memoryCache.size,
        };
      }
    } catch (error) {
      return {
        type: "memory",
        keys: this.memoryCache.size,
      };
    }
  }

  private cleanupExpiredMemoryCache(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, cached] of this.memoryCache.entries()) {
      if (cached.expiry < now) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired memory cache entries`);
    }
  }

  private trackNamespaceMetric(key: string, type: "hit" | "miss"): void {
    // Extract namespace from key (e.g., "navasan:ohlc:currencies:..." -> "navasan:ohlc")
    const parts = key.split(":");
    const namespace = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : key;

    if (type === "hit") {
      const current = this.metrics.hitsByNamespace.get(namespace) || 0;
      this.metrics.hitsByNamespace.set(namespace, current + 1);
    } else {
      const current = this.metrics.missesByNamespace.get(namespace) || 0;
      this.metrics.missesByNamespace.set(namespace, current + 1);
    }
  }

  getMetrics(): {
    total: {
      hits: number;
      misses: number;
      sets: number;
      deletes: number;
      errors: number;
      requests: number;
      hitRate: number;
    };
    byNamespace: {
      [namespace: string]: {
        hits: number;
        misses: number;
        requests: number;
        hitRate: number;
      };
    };
  } {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    const hitRate =
      totalRequests > 0 ? (this.metrics.hits / totalRequests) * 100 : 0;

    // Build namespace metrics
    const namespaces = new Set<string>([
      ...this.metrics.hitsByNamespace.keys(),
      ...this.metrics.missesByNamespace.keys(),
    ]);

    const byNamespace: {
      [namespace: string]: {
        hits: number;
        misses: number;
        requests: number;
        hitRate: number;
      };
    } = {};

    for (const namespace of namespaces) {
      const hits = this.metrics.hitsByNamespace.get(namespace) || 0;
      const misses = this.metrics.missesByNamespace.get(namespace) || 0;
      const requests = hits + misses;
      const nsHitRate = requests > 0 ? (hits / requests) * 100 : 0;

      byNamespace[namespace] = {
        hits,
        misses,
        requests,
        hitRate: parseFloat(nsHitRate.toFixed(2)),
      };
    }

    return {
      total: {
        hits: this.metrics.hits,
        misses: this.metrics.misses,
        sets: this.metrics.sets,
        deletes: this.metrics.deletes,
        errors: this.metrics.errors,
        requests: totalRequests,
        hitRate: parseFloat(hitRate.toFixed(2)),
      },
      byNamespace,
    };
  }

  resetMetrics(): void {
    this.metrics.hits = 0;
    this.metrics.misses = 0;
    this.metrics.sets = 0;
    this.metrics.deletes = 0;
    this.metrics.errors = 0;
    this.metrics.hitsByNamespace.clear();
    this.metrics.missesByNamespace.clear();
    this.logger.log("Cache metrics reset");
  }

  async onModuleDestroy() {
    clearInterval(this.cleanupInterval);
    if (this.redis) {
      await this.redis.quit();
      this.logger.log("Redis connection closed");
    }
  }
}
