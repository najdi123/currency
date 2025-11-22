import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private readonly useRedis: boolean;
  private memoryCache = new Map<string, { value: any; expiry: number }>();
  private cleanupInterval: NodeJS.Timeout;

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
          retryStrategy: (times) => {
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

        this.redis.on("error", (error) => {
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
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to set cache key "${key}": ${err.message}`);
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
            return null;
          }
          serialized = cached.value;
        }
      }
      if (serialized === null) {
        return null;
      }
      return JSON.parse(serialized) as T;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to get cache key "${key}": ${err.message}`);
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
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to delete cache key "${key}": ${err.message}`);
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

  async onModuleDestroy() {
    clearInterval(this.cleanupInterval);
    if (this.redis) {
      await this.redis.quit();
      this.logger.log("Redis connection closed");
    }
  }
}
