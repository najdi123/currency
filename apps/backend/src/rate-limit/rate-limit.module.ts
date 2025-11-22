import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RateLimitService } from './rate-limit.service';
import { RateLimitController } from './rate-limit.controller';
import { RateLimitGuard } from './rate-limit.guard';
import { UserRateLimit, UserRateLimitSchema } from '../schemas/user-rate-limit.schema';

/**
 * Rate Limit Module - 2-hour window system
 *
 * Provides rate limiting service and guard for API endpoints
 * Implements 20 requests per 2-hour window per user
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserRateLimit.name, schema: UserRateLimitSchema },
    ]),
  ],
  controllers: [RateLimitController],
  providers: [RateLimitService, RateLimitGuard],
  exports: [RateLimitService, RateLimitGuard],
})
export class RateLimitModule {}
