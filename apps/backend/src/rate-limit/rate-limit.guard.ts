import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitService } from './rate-limit.service';
import { UserTier } from '../schemas/user-rate-limit.schema';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private rateLimitService: RateLimitService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    try {
      // Get identifier (user ID or IP) with security validation
      const identifier = this.getIdentifier(request);
      const tier = this.getUserTier(request);

      // Check rate limit
      const rateLimitCheck = await this.rateLimitService.checkRateLimit(identifier, tier);

      // Set rate limit headers
      response.setHeader('X-RateLimit-Limit', rateLimitCheck.limit);
      response.setHeader('X-RateLimit-Remaining', rateLimitCheck.remaining);
      response.setHeader('X-RateLimit-Reset', rateLimitCheck.resetAt.toISOString());

      if (!rateLimitCheck.allowed) {
        response.setHeader('Retry-After', rateLimitCheck.retryAfter);

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Rate limit exceeded',
            remaining: 0,
            limit: rateLimitCheck.limit,
            resetAt: rateLimitCheck.resetAt,
            retryAfter: rateLimitCheck.retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error) {
      // If it's our own rate limit error, rethrow
      if (error instanceof HttpException) {
        throw error;
      }

      // Database or service error - log but allow request (fail-open for availability)
      this.logger.error('Rate limit check failed, allowing request', error);

      // Set degraded service header
      response.setHeader('X-RateLimit-Status', 'degraded');

      return true; // Fail-open: allow request when rate limiting is broken
    }
  }

  private getIdentifier(request: any): string {
    // Prioritize authenticated user ID (most secure)
    if (request.user?.id && typeof request.user.id === 'string') {
      return `user:${request.user.id}`;
    }

    // Get real IP considering proxy headers
    const ip = this.getRealIp(request);
    return `ip:${ip}`;
  }

  private getRealIp(request: any): string {
    const trustProxy = this.configService.get<string>('TRUST_PROXY', 'false') === 'true';

    // If behind trusted proxy, use X-Forwarded-For
    if (trustProxy) {
      const forwarded = request.headers['x-forwarded-for'];
      if (forwarded && typeof forwarded === 'string') {
        // Take first IP in chain (original client)
        const firstIp = forwarded.split(',')[0].trim();
        if (firstIp) return firstIp;
      }
    }

    // Fallback to direct connection IP
    return request.ip || request.connection?.remoteAddress || 'unknown';
  }

  private getUserTier(request: any): UserTier {
    const tier = request.user?.tier;

    // Validate tier is one of the enum values
    if (tier && Object.values(UserTier).includes(tier)) {
      return tier;
    }

    return UserTier.FREE;
  }
}
