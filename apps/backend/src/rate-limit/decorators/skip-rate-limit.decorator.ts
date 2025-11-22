import { SetMetadata } from "@nestjs/common";

/**
 * Decorator to skip rate limiting for specific routes
 *
 * @example
 * ```typescript
 * @Get('health')
 * @SkipRateLimit()
 * async healthCheck() {
 *   return { status: 'ok' };
 * }
 * ```
 */
export const SKIP_RATE_LIMIT_KEY = "skipRateLimit";
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);
