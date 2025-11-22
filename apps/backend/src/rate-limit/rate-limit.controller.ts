import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RateLimitService } from './rate-limit.service';
import { SkipRateLimit } from './decorators/skip-rate-limit.decorator';

/**
 * Rate Limit Status Controller
 *
 * Provides endpoints for checking rate limit status
 * Returns information about current 2-hour window and remaining quota
 */
@ApiTags('Rate Limiting')
@Controller('rate-limit')
export class RateLimitController {
  constructor(private rateLimitService: RateLimitService) {}

  /**
   * GET /api/rate-limit/status
   * Returns rate limit status for the current user/IP
   * Note: This endpoint does not consume quota
   */
  @Get('status')
  @SkipRateLimit()
  @ApiOperation({
    summary: 'Get current rate limit status',
    description:
      'Returns the current rate limit status for the requesting user/IP. ' +
      'Shows remaining quota within the current 2-hour window. ' +
      'This endpoint does NOT consume quota.',
  })
  @ApiResponse({
    status: 200,
    description: 'Rate limit status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        allowed: {
          type: 'boolean',
          description: 'Whether requests are currently allowed',
          example: true,
        },
        remaining: {
          type: 'number',
          description: 'Number of requests remaining in current window',
          example: 15,
        },
        retryAfter: {
          type: 'number',
          description: 'Seconds until quota resets (only present when quota exceeded)',
          example: 3600,
        },
        windowStart: {
          type: 'string',
          format: 'date-time',
          description: 'Start time of current 2-hour window (Tehran timezone)',
          example: '2025-01-20T14:00:00.000Z',
        },
        windowEnd: {
          type: 'string',
          format: 'date-time',
          description: 'End time of current 2-hour window (Tehran timezone)',
          example: '2025-01-20T16:00:00.000Z',
        },
        showStaleData: {
          type: 'boolean',
          description: 'Whether to show stale data (quota exceeded)',
          example: false,
        },
        percentage: {
          type: 'number',
          description: 'Percentage of quota remaining (0-100)',
          example: 75,
        },
        maxRequestsPerWindow: {
          type: 'number',
          description: 'Maximum requests allowed per window',
          example: 20,
        },
        windowDurationHours: {
          type: 'number',
          description: 'Duration of rate limit window in hours',
          example: 2,
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error (returns safe defaults)',
  })
  async getStatus(@Req() request: Request) {
    try {
      const identifier = this.rateLimitService.getIdentifierFromRequest(request);
      const status = await this.rateLimitService.getRateLimitStatus(identifier);

      // Get max requests and window duration from service configuration
      const maxRequestsPerWindow = this.rateLimitService.getMaxRequestsPerWindow();
      const windowDurationHours = this.rateLimitService.getWindowDurationHours();

      // Calculate percentage of quota remaining
      const percentage = Math.round((status.remaining / maxRequestsPerWindow) * 100);

      return {
        ...status,
        percentage,
        maxRequestsPerWindow,
        windowDurationHours,
      };
    } catch (error) {
      // Log error but return safe defaults to prevent frontend breakage
      console.error('Failed to get rate limit status:', error);

      // Return safe defaults that allow requests
      const now = new Date();
      const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      return {
        allowed: true,
        remaining: 20,
        windowStart: now,
        windowEnd: twoHoursLater,
        showStaleData: false,
        percentage: 100,
        maxRequestsPerWindow: 20,
        windowDurationHours: 2,
      };
    }
  }
}
