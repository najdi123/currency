import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminOverrideService } from './admin-override.service';
import {
  ManagedItem,
  ManagedItemSchema,
} from '../schemas/managed-item.schema';
import {
  OHLCPermanent,
  OHLCPermanentSchema,
} from '../market-data/schemas/ohlc-permanent.schema';

/**
 * AdminModule
 *
 * Provides admin functionality for managing market items:
 * - CRUD operations on managed_items collection
 * - Price override capability with timed expiration
 * - Scheduled cleanup of expired overrides (runs every minute)
 * - Diagnostic tools for debugging data issues
 *
 * All endpoints are protected with JWT + Admin role guard.
 *
 * This module uses:
 * - managed_items: Admin layer for configuration and overrides
 * - ohlc_permanent: Source of truth for price data (read-only)
 *
 * Override Duration Feature:
 * - Admins can set how long an override should last (1min to 24hrs)
 * - Default duration is 60 minutes (1 hour)
 * - Indefinite overrides are supported (never expire)
 * - Scheduler runs every minute to clear expired overrides
 */
@Module({
  imports: [
    // Note: ScheduleModule.forRoot() is already imported in SchedulerModule
    // The @Cron decorator in AdminService will work because SchedulerModule
    // is loaded before AdminModule in app.module.ts
    MongooseModule.forFeature([
      { name: ManagedItem.name, schema: ManagedItemSchema },
      { name: OHLCPermanent.name, schema: OHLCPermanentSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminOverrideService],
  exports: [AdminService, AdminOverrideService], // Export for use in MarketDataOrchestratorService
})
export class AdminModule {}
