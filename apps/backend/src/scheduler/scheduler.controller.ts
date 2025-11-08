import { Controller, Post, Get, Put, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { NavasanSchedulerService } from './navasan-scheduler.service';
import { IsInt, Min, Max } from 'class-validator';

// DTO for updating interval
class UpdateIntervalDto {
  @IsInt()
  @Min(1)
  @Max(1440) // Max 24 hours
  intervalMinutes!: number;
}

@Controller('scheduler')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchedulerController {
  constructor(
    private readonly schedulerService: NavasanSchedulerService,
  ) {}

  /**
   * Trigger manual fetch (admin only)
   * POST /scheduler/trigger
   *
   * Example:
   * curl -X POST http://localhost:4000/scheduler/trigger \
   *   -H "Authorization: Bearer YOUR_ADMIN_JWT"
   */
  @Post('trigger')
  @Roles('admin')
  async triggerManualFetch() {
    return this.schedulerService.triggerManualFetch();
  }

  /**
   * Get scheduler configuration and status
   * GET /scheduler/config
   *
   * Returns:
   * - enabled: Whether scheduler is enabled
   * - intervalMinutes: Current interval setting
   * - cronExpression: Custom cron if set
   * - timezone: Scheduler timezone
   * - nextRun: Next scheduled execution time
   */
  @Get('config')
  @Roles('admin')
  getConfig() {
    return this.schedulerService.getSchedulerConfig();
  }

  /**
   * Update scheduler interval at runtime (admin only)
   * PUT /scheduler/interval
   *
   * Body: { "intervalMinutes": 30 }
   *
   * Example:
   * curl -X PUT http://localhost:4000/scheduler/interval \
   *   -H "Authorization: Bearer YOUR_ADMIN_JWT" \
   *   -H "Content-Type: application/json" \
   *   -d '{"intervalMinutes": 30}'
   */
  @Put('interval')
  @Roles('admin')
  async updateInterval(@Body() dto: UpdateIntervalDto) {
    await this.schedulerService.updateInterval(dto.intervalMinutes);
    return {
      success: true,
      message: `Scheduler interval updated to ${dto.intervalMinutes} minutes`,
      nextRun: this.schedulerService.getNextRunTime(),
    };
  }

  /**
   * Get next scheduled run time
   * GET /scheduler/next-run
   *
   * Legacy endpoint - use /scheduler/config instead
   */
  @Get('next-run')
  @Roles('admin')
  getNextRun() {
    return {
      nextRun: this.schedulerService.getNextRunTime(),
    };
  }
}
