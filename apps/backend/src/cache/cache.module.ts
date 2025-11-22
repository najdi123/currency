import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CacheService } from "./cache.service";
import { CacheController } from "./cache.controller";

/**
 * Cache Module
 *
 * Provides Redis-based caching with in-memory fallback.
 * Marked as @Global to make CacheService available throughout the application
 * without needing to import CacheModule in every module.
 *
 * Exposes monitoring endpoints via CacheController:
 * - GET /cache/metrics - Detailed hit/miss metrics
 * - GET /cache/stats - Cache statistics (keys, memory)
 * - GET /cache/health - Comprehensive health check
 * - POST /cache/metrics/reset - Reset metrics counters
 */
@Global()
@Module({
  imports: [ConfigModule],
  controllers: [CacheController],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
