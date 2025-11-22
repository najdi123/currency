import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from './rate-limit.service';
import { SKIP_RATE_LIMIT_KEY } from './decorators/skip-rate-limit.decorator';

/**
 * Rate Limit Guard - 2-hour window system
 *
 * Checks if user has remaining quota in current 2-hour window
 * If quota exceeded: Throws 429 with stale data flag
 * Controllers can catch 429 and serve stale data instead
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private rateLimitService: RateLimitService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Check if rate limiting is disabled for this route
    const skipRateLimit = this.reflector.get<boolean>(
      SKIP_RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (skipRateLimit) {
      return true;
    }

    try {
      // Get identifier (user ID or IP)
      const identifier = this.rateLimitService.getIdentifierFromRequest(request);

      // Extract metadata for tracking
      const endpoint = request.path;
      const itemType = request.params?.itemType || request.query?.itemType;

      // Atomically check and consume quota (prevents race conditions)
      const rateLimitCheck = await this.rateLimitService.checkAndConsumeQuota(identifier, {
        endpoint,
        itemType,
      });

      // Get max requests from service
      const maxRequests = this.rateLimitService.getMaxRequestsPerWindow();

      // Set standard RateLimit-* headers (RFC 6585 / draft-ietf-httpapi-ratelimit-headers)
      response.setHeader('RateLimit-Limit', maxRequests.toString());
      response.setHeader('RateLimit-Remaining', rateLimitCheck.remaining.toString());
      response.setHeader('RateLimit-Reset', rateLimitCheck.windowEnd.toISOString());

      // Set legacy X-RateLimit-* headers for backwards compatibility
      response.setHeader('X-RateLimit-Limit', maxRequests.toString());
      response.setHeader('X-RateLimit-Remaining', rateLimitCheck.remaining.toString());
      response.setHeader('X-RateLimit-Reset', rateLimitCheck.windowEnd.toISOString());
      response.setHeader('X-RateLimit-Window-Start', rateLimitCheck.windowStart.toISOString());
      response.setHeader('X-RateLimit-Window-End', rateLimitCheck.windowEnd.toISOString());

      if (!rateLimitCheck.allowed) {
        // Quota exceeded - set retry header
        response.setHeader('Retry-After', rateLimitCheck.retryAfter);

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Fresh data quota exceeded. Showing stale data.',
            remaining: 0,
            retryAfter: rateLimitCheck.retryAfter,
            windowEnd: rateLimitCheck.windowEnd,
            showStaleData: true,
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
}
