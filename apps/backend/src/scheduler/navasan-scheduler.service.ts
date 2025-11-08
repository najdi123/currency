import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import { NavasanService } from '../navasan/navasan.service';

@Injectable()
export class NavasanSchedulerService {
  private readonly logger = new Logger(NavasanSchedulerService.name);
  private fetchPromise: Promise<void> | null = null;
  private cronJob: CronJob | null = null;

  constructor(
    private readonly navasanService: NavasanService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configService: ConfigService,
  ) {
    this.initializeScheduler();
  }

  /**
   * Initialize scheduler with dynamic configuration
   */
  private initializeScheduler() {
    const isEnabled = this.configService.get<string>('SCHEDULER_ENABLED', 'false') === 'true';

    if (!isEnabled) {
      this.logger.warn('⚠️  Scheduler is DISABLED (set SCHEDULER_ENABLED=true to enable)');
      return;
    }

    // Get configuration
    const customCron = this.configService.get<string>('SCHEDULER_CRON_EXPRESSION');
    const intervalMinutes = parseInt(
      this.configService.get<string>('SCHEDULER_INTERVAL_MINUTES', '60'),
      10
    );
    const timezone = this.configService.get<string>('SCHEDULER_TIMEZONE', 'UTC');

    // Determine cron expression
    let cronExpression: string;
    if (customCron) {
      cronExpression = customCron;
      this.logger.log(`📅 Using custom cron expression: ${cronExpression}`);
    } else {
      cronExpression = this.intervalToCronExpression(intervalMinutes);
      this.logger.log(`📅 Using interval-based cron: Every ${intervalMinutes} minute(s)`);
    }

    // Create dynamic cron job
    this.cronJob = new CronJob(
      cronExpression,
      () => this.fetchAllData(),
      null, // onComplete
      true, // start
      timezone,
    );

    // Register with scheduler registry
    this.schedulerRegistry.addCronJob('navasan-dynamic-fetch', this.cronJob);

    const nextRun = this.cronJob.nextDate().toJSDate();
    this.logger.log(`✅ Scheduler initialized. Next run: ${nextRun.toISOString()}`);
  }

  /**
   * Convert interval in minutes to cron expression
   */
  private intervalToCronExpression(minutes: number): string {
    if (minutes < 1) {
      this.logger.warn('⚠️  Invalid interval (<1 min), defaulting to 1 hour');
      return CronExpression.EVERY_HOUR;
    }

    // Every N minutes (if < 60)
    if (minutes < 60) {
      return `*/${minutes} * * * *`;
    }

    // Every N hours (if divisible by 60)
    if (minutes % 60 === 0) {
      const hours = minutes / 60;
      if (hours === 1) return CronExpression.EVERY_HOUR;
      return `0 */${hours} * * *`;
    }

    // Complex intervals (e.g., 90 minutes = every 1.5 hours)
    // Fall back to checking every N minutes
    return `*/${minutes} * * * *`;
  }

  /**
   * Main scheduled fetch method (no decorator, called by dynamic cron)
   */
  async fetchAllData() {
    if (this.fetchPromise) {
      this.logger.warn('⚠️  Previous scheduled fetch still running, skipping...');
      return;
    }

    this.fetchPromise = this._doFetch();
    try {
      await this.fetchPromise;
    } finally {
      this.fetchPromise = null;
    }
  }

  /**
   * Private method that performs the actual fetch operation
   * Separated from fetchAllData to enable Promise-based locking
   */
  private async _doFetch() {
    const startTime = Date.now();
    const intervalMinutes = this.configService.get<string>('SCHEDULER_INTERVAL_MINUTES', '60');

    this.logger.log(
      `⏰ === SCHEDULED FETCH STARTED (interval: ${intervalMinutes}m) ===`
    );

    try {
      // Use forceFetchAndCache for guaranteed API hits (bypasses fresh cache)
      const results = await Promise.allSettled([
        this.navasanService.forceFetchAndCache('currencies'),
        this.navasanService.forceFetchAndCache('crypto'),
        this.navasanService.forceFetchAndCache('gold'),
      ]);

      const [currencies, crypto, gold] = results;
      this.logForceFetchResult('Currencies', currencies);
      this.logForceFetchResult('Crypto', crypto);
      this.logForceFetchResult('Gold', gold);

      const successCount = results.filter(
        r => r.status === 'fulfilled' && r.value.success
      ).length;
      const failureCount = results.filter(
        r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
      ).length;
      const duration = Date.now() - startTime;

      this.logger.log(
        `⏰ === FETCH COMPLETED === ` +
        `Success: ${successCount}/3 | Failed: ${failureCount}/3 | Duration: ${duration}ms`
      );

      if (successCount === 0) {
        this.logger.error('🚨 CRITICAL: All scheduled fetches failed! Check API key and connectivity.');
      }

    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Unexpected error in scheduled fetch: ${err.message}`, err.stack);
    }
  }

  /**
   * Helper: Log force fetch result (for forceFetchAndCache method)
   */
  private logForceFetchResult(
    category: string,
    result: PromiseSettledResult<{ success: boolean; error?: string }>
  ) {
    if (result.status === 'fulfilled' && result.value.success) {
      this.logger.log(`✅ ${category} force fetched successfully`);
    } else if (result.status === 'fulfilled' && !result.value.success) {
      this.logger.error(`❌ ${category} force fetch failed: ${result.value.error}`);
    } else if (result.status === 'rejected') {
      this.logger.error(
        `❌ ${category} force fetch rejected: ${result.reason?.message || result.reason}`
      );
    }
  }

  /**
   * Manual trigger for testing or admin panel
   */
  async triggerManualFetch(): Promise<{ success: boolean; message: string }> {
    this.logger.log('🔧 Manual fetch triggered');
    try {
      await this.fetchAllData();
      return { success: true, message: 'Manual fetch completed' };
    } catch (error) {
      const err = error as Error;
      return { success: false, message: `Manual fetch failed: ${err.message}` };
    }
  }

  /**
   * Get next scheduled run time
   */
  getNextRunTime(): Date | null {
    if (!this.cronJob) {
      return null;
    }
    return this.cronJob.nextDate().toJSDate();
  }

  /**
   * Get current scheduler configuration
   */
  getSchedulerConfig() {
    return {
      enabled: this.configService.get<string>('SCHEDULER_ENABLED') === 'true',
      intervalMinutes: this.configService.get<string>('SCHEDULER_INTERVAL_MINUTES'),
      cronExpression: this.configService.get<string>('SCHEDULER_CRON_EXPRESSION'),
      timezone: this.configService.get<string>('SCHEDULER_TIMEZONE'),
      nextRun: this.getNextRunTime(),
    };
  }

  /**
   * Update scheduler interval at runtime (admin feature)
   */
  async updateInterval(newIntervalMinutes: number): Promise<void> {
    this.logger.log(`🔧 Updating scheduler interval to ${newIntervalMinutes} minutes`);

    // Remove old job
    if (this.cronJob) {
      this.cronJob.stop();
      this.schedulerRegistry.deleteCronJob('navasan-dynamic-fetch');
    }

    // Create new job with new interval
    const timezone = this.configService.get<string>('SCHEDULER_TIMEZONE', 'UTC');
    const cronExpression = this.intervalToCronExpression(newIntervalMinutes);

    this.cronJob = new CronJob(
      cronExpression,
      () => this.fetchAllData(),
      null,
      true,
      timezone,
    );

    this.schedulerRegistry.addCronJob('navasan-dynamic-fetch', this.cronJob);

    this.logger.log(`✅ Scheduler updated. Next run: ${this.getNextRunTime()?.toISOString()}`);
  }
}
