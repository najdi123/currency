import { Module, forwardRef } from '@nestjs/common';
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
 * - Price override capability
 * - Diagnostic tools for debugging data issues
 *
 * All endpoints are protected with JWT + Admin role guard.
 *
 * This module uses:
 * - managed_items: Admin layer for configuration and overrides
 * - ohlc_permanent: Source of truth for price data (read-only)
 */
@Module({
  imports: [
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
