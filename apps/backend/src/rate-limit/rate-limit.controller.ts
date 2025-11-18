import { Controller, Get, Req } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { UserTier } from '../schemas/user-rate-limit.schema';

@Controller('rate-limit')
export class RateLimitController {
  constructor(private rateLimitService: RateLimitService) {}

  @Get('status')
  async getStatus(@Req() request: any) {
    const identifier = request.user?.id || request.ip || 'anonymous';
    const tier = request.user?.tier || UserTier.FREE;

    const status = await this.rateLimitService.getRateLimitStatus(identifier);

    return {
      tier,
      ...status,
      percentage: Math.round((status.remaining / status.limit) * 100),
    };
  }
}
