import { Module, Global } from "@nestjs/common";
import { MetricsService } from "./metrics.service";
import { MetricsController } from "./metrics.controller";

/**
 * Metrics Module
 *
 * Global module providing metrics tracking across the application.
 * Marked as @Global so MetricsService can be injected anywhere without importing.
 *
 * Exposes monitoring endpoints via MetricsController:
 * - GET /metrics/performance - Comprehensive performance report
 * - GET /metrics/health - Health status
 * - GET /metrics/cache - Cache metrics
 * - GET /metrics/rate-limit - Rate limit metrics
 * - GET /metrics/failures - Failure tracking
 * - POST /metrics/reset - Reset all metrics
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
