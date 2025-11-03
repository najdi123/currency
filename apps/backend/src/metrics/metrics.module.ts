import { Module, Global } from '@nestjs/common';
import { MetricsService } from './metrics.service';

/**
 * Metrics Module
 *
 * Global module providing metrics tracking across the application.
 * Marked as @Global so MetricsService can be injected anywhere without importing.
 */
@Global()
@Module({
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
