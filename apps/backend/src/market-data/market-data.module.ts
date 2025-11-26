import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Controller
import { MarketDataController } from './market-data.controller';

// Orchestrator service
import { MarketDataOrchestratorService } from './market-data-orchestrator.service';

// New specialized services
import { MarketDataCategoryService } from './services/market-data-category.service';
import { MarketDataValidationService } from './services/market-data-validation.service';
import { MarketDataCacheService } from './services/market-data-cache.service';
import { MarketDataSnapshotService } from './services/market-data-snapshot.service';
import { MarketDataEnrichmentService } from './services/market-data-enrichment.service';
import { MarketDataCircuitBreakerService } from './services/market-data-circuit-breaker.service';

// Legacy services (from navasan module - to be used until fully migrated)
import { IntradayOhlcService } from '../navasan/services/intraday-ohlc.service';

// Schemas (shared with navasan module)
import { Cache, CacheSchema } from '../navasan/schemas/cache.schema';
import { PriceSnapshot, PriceSnapshotSchema } from '../navasan/schemas/price-snapshot.schema';
import { OhlcSnapshot, OhlcSnapshotSchema } from '../navasan/schemas/ohlc-snapshot.schema';
import { OHLCPermanent, OHLCPermanentSchema } from '../navasan/schemas/ohlc-permanent.schema';
import { AggregationRule, AggregationRuleSchema } from '../navasan/schemas/aggregation-rule.schema';
import { UpdateLog, UpdateLogSchema } from '../navasan/schemas/update-log.schema';

// External modules
import { MetricsModule } from '../metrics/metrics.module';
import { ApiProvidersModule } from '../api-providers/api-providers.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';

/**
 * MarketDataModule
 *
 * Provider-agnostic market data module that replaces the old NavasanModule.
 * This module provides a clean architecture with specialized services:
 *
 * - CategoryService: Category management and item codes
 * - ValidationService: Input validation and security
 * - CacheService: Redis + MongoDB caching
 * - SnapshotService: Price snapshot management
 * - EnrichmentService: Data enrichment with OHLC
 * - CircuitBreakerService: Failure protection
 * - OrchestratorService: Thin orchestration layer
 *
 * The module supports dual-path routing:
 * - /api/market-data/* (new, recommended)
 * - /api/navasan/* (legacy, deprecated)
 */
@Module({
  imports: [
    // MongoDB schemas
    MongooseModule.forFeature([
      { name: Cache.name, schema: CacheSchema },
      { name: PriceSnapshot.name, schema: PriceSnapshotSchema },
      { name: OhlcSnapshot.name, schema: OhlcSnapshotSchema },
      { name: OHLCPermanent.name, schema: OHLCPermanentSchema },
      { name: AggregationRule.name, schema: AggregationRuleSchema },
      { name: UpdateLog.name, schema: UpdateLogSchema },
    ]),

    // External modules
    MetricsModule,
    ApiProvidersModule,
    RateLimitModule,
  ],
  controllers: [
    MarketDataController,
  ],
  providers: [
    // Main orchestrator
    MarketDataOrchestratorService,

    // New specialized services
    MarketDataCategoryService,
    MarketDataValidationService,
    MarketDataCacheService,
    MarketDataSnapshotService,
    MarketDataEnrichmentService,
    MarketDataCircuitBreakerService,

    // Legacy service (shared with NavasanModule)
    IntradayOhlcService,
  ],
  exports: [
    // Export orchestrator for use in other modules (scheduler, ohlc-collector)
    MarketDataOrchestratorService,

    // Export specialized services for advanced use cases
    MarketDataCategoryService,
    MarketDataValidationService,
    MarketDataCacheService,
    MarketDataSnapshotService,
    MarketDataEnrichmentService,

    // Export legacy service for compatibility
    IntradayOhlcService,

    // Export MongooseModule to make schemas available
    MongooseModule,
  ],
})
export class MarketDataModule {}
