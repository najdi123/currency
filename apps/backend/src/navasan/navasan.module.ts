import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { NavasanController } from "./navasan.controller";
import { NavasanService } from "./navasan.service";
import { IntradayOhlcService } from "./services/intraday-ohlc.service";

// New modular services
import { NavasanFetcherService } from "./services/navasan-fetcher.service";
import { NavasanCacheManagerService } from "./services/navasan-cache-manager.service";
import { NavasanTransformerService } from "./services/navasan-transformer.service";
import { NavasanCircuitBreakerService } from "./services/navasan-circuit-breaker.service";
import { NavasanOhlcService } from "./services/navasan-ohlc.service";
import { NavasanHistoricalService } from "./services/navasan-historical.service";

import { Cache, CacheSchema } from "./schemas/cache.schema";
import {
  PriceSnapshot,
  PriceSnapshotSchema,
} from "./schemas/price-snapshot.schema";
import {
  OhlcSnapshot,
  OhlcSnapshotSchema,
} from "./schemas/ohlc-snapshot.schema";
import {
  OHLCPermanent,
  OHLCPermanentSchema,
} from "./schemas/ohlc-permanent.schema";
import {
  AggregationRule,
  AggregationRuleSchema,
} from "./schemas/aggregation-rule.schema";
import { UpdateLog, UpdateLogSchema } from "./schemas/update-log.schema";
import { MetricsModule } from "../metrics/metrics.module";
import { ApiProvidersModule } from "../api-providers/api-providers.module";
import { RateLimitModule } from "../rate-limit/rate-limit.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cache.name, schema: CacheSchema },
      { name: PriceSnapshot.name, schema: PriceSnapshotSchema },
      { name: OhlcSnapshot.name, schema: OhlcSnapshotSchema },
      { name: OHLCPermanent.name, schema: OHLCPermanentSchema },
      { name: AggregationRule.name, schema: AggregationRuleSchema },
      { name: UpdateLog.name, schema: UpdateLogSchema },
    ]),
    MetricsModule,
    ApiProvidersModule, // Import API providers for PersianAPI integration
    RateLimitModule, // Import rate limiting module
  ],
  controllers: [NavasanController],
  providers: [
    // Core orchestration service
    NavasanService,

    // Modular services (new architecture)
    NavasanFetcherService,
    NavasanCacheManagerService,
    NavasanTransformerService,
    NavasanCircuitBreakerService,
    NavasanOhlcService,
    NavasanHistoricalService,

    // Legacy service (to be refactored)
    IntradayOhlcService,
  ],
  exports: [
    NavasanService,
    IntradayOhlcService,

    // Export new services for use in other modules
    NavasanFetcherService,
    NavasanCacheManagerService,
    NavasanTransformerService,
    NavasanOhlcService,
    NavasanHistoricalService,

    MongooseModule, // Export MongooseModule to make the models available to other modules
  ],
})
export class NavasanModule {}
