import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { RateLimitService } from './rate-limit.service';
import { RateLimitController } from './rate-limit.controller';
import { UserRateLimit, UserRateLimitSchema } from '../schemas/user-rate-limit.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: UserRateLimit.name, schema: UserRateLimitSchema },
    ]),
  ],
  controllers: [RateLimitController],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
