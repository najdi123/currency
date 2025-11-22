import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { SchedulerRegistry, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { CronJob } from "cron";
import { NavasanService } from "../navasan/navasan.service";
import { ScheduleConfigService } from "./schedule-config.service";

@Injectable()
export class NavasanSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NavasanSchedulerService.name);
  private fetchPromise: Promise<void> | null = null;
  private cronJob: CronJob | null = null;
  private dynamicTimeout: NodeJS.Timeout | null = null;
  private useDynamicScheduling: boolean = false;

  constructor(
    private readonly navasanService: NavasanService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configService: ConfigService,
    private readonly scheduleConfig: ScheduleConfigService,
  ) {}

  /**
   * Initialize scheduler on module initialization
   */
  onModuleInit() {
    this.initializeScheduler();
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy() {
    if (this.cronJob) {
      this.cronJob.stop();
    }
    if (this.dynamicTimeout) {
      clearTimeout(this.dynamicTimeout);
    }
  }

  /**
   * Initialize scheduler with dynamic configuration
   */
  private initializeScheduler() {
    const isEnabled =
      this.configService.get<string>("SCHEDULER_ENABLED", "false") === "true";

    if (!isEnabled) {
      this.logger.warn(
        "⚠️  Scheduler is DISABLED (set SCHEDULER_ENABLED=true to enable)",
      );
      return;
    }

    // Check if dynamic scheduling is enabled
    this.useDynamicScheduling =
      this.configService.get<string>("SCHEDULER_USE_DYNAMIC", "true") ===
      "true";

    if (this.useDynamicScheduling) {
      this.logger.log("🌟 Using DYNAMIC scheduling (time-of-day aware)");
      this.startDynamicScheduler();
    } else {
      this.logger.log("📅 Using STATIC scheduling (cron-based)");
      this.startStaticScheduler();
    }
  }

  /**
   * Start dynamic scheduler (time-of-day aware)
   */
  private startDynamicScheduler() {
    const currentPeriod = this.scheduleConfig.getCurrentSchedulePeriod();
    const intervalMinutes = this.scheduleConfig.getCurrentScheduleInterval();
    const nextRun = this.scheduleConfig.getNextScheduledTime();
    const tehranTime = this.scheduleConfig
      .getTehranTime()
      .format("YYYY-MM-DD HH:mm:ss");

    this.logger.log(`✅ Dynamic Scheduler initialized`);
    this.logger.log(`   Current Period: ${currentPeriod}`);
    this.logger.log(`   Current Interval: ${intervalMinutes} minutes`);
    this.logger.log(`   Tehran Time: ${tehranTime}`);
    this.logger.log(`   Next Run: ${nextRun.toISOString()}`);

    // Schedule first fetch
    this.scheduleDynamicFetch();
  }

  /**
   * Schedule next fetch with dynamic interval
   */
  private scheduleDynamicFetch() {
    // Clear any existing timeout
    if (this.dynamicTimeout) {
      clearTimeout(this.dynamicTimeout);
    }

    const intervalMinutes = this.scheduleConfig.getCurrentScheduleInterval();
    const nextTime = this.scheduleConfig.getNextScheduledTime();
    const currentPeriod = this.scheduleConfig.getCurrentSchedulePeriod();
    const delay = intervalMinutes * 60 * 1000; // Convert to milliseconds

    this.logger.log(
      `⏰ Next fetch scheduled for ${nextTime.toISOString()} ` +
        `(${currentPeriod}, ${intervalMinutes}m interval)`,
    );

    this.dynamicTimeout = setTimeout(async () => {
      await this.fetchAllData();
      // Reschedule for next interval (may be different based on new time)
      this.scheduleDynamicFetch();
    }, delay);
  }

  /**
   * Start static scheduler (original cron-based)
   */
  private startStaticScheduler() {
    // Get configuration
    const customCron = this.configService.get<string>(
      "SCHEDULER_CRON_EXPRESSION",
    );
    const intervalMinutes = parseInt(
      this.configService.get<string>("SCHEDULER_INTERVAL_MINUTES", "60"),
      10,
    );
    const timezone = this.configService.get<string>(
      "SCHEDULER_TIMEZONE",
      "UTC",
    );

    // Determine cron expression
    let cronExpression: string;
    if (customCron) {
      cronExpression = customCron;
      this.logger.log(`📅 Using custom cron expression: ${cronExpression}`);
    } else {
      cronExpression = this.intervalToCronExpression(intervalMinutes);
      this.logger.log(
        `📅 Using interval-based cron: Every ${intervalMinutes} minute(s)`,
      );
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
    this.schedulerRegistry.addCronJob("navasan-dynamic-fetch", this.cronJob);

    const nextRun = this.cronJob.nextDate().toJSDate();
    this.logger.log(
      `✅ Static Scheduler initialized. Next run: ${nextRun.toISOString()}`,
    );
  }

  /**
   * Convert interval in minutes to cron expression
   */
  private intervalToCronExpression(minutes: number): string {
    if (minutes < 1) {
      this.logger.warn("⚠️  Invalid interval (<1 min), defaulting to 1 hour");
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
      this.logger.warn(
        "⚠️  Previous scheduled fetch still running, skipping...",
      );
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
    const intervalMinutes = this.configService.get<string>(
      "SCHEDULER_INTERVAL_MINUTES",
      "60",
    );

    this.logger.log(
      `⏰ === SCHEDULED FETCH STARTED (interval: ${intervalMinutes}m) ===`,
    );

    try {
      // Use forceFetchAndCache for guaranteed API hits (bypasses fresh cache)
      const results = await Promise.allSettled([
        this.navasanService.forceFetchAndCache("currencies"),
        this.navasanService.forceFetchAndCache("crypto"),
        this.navasanService.forceFetchAndCache("gold"),
      ]);

      const [currencies, crypto, gold] = results;
      this.logForceFetchResult("Currencies", currencies);
      this.logForceFetchResult("Crypto", crypto);
      this.logForceFetchResult("Gold", gold);

      const successCount = results.filter(
        (r) => r.status === "fulfilled" && r.value.success,
      ).length;
      const failureCount = results.filter(
        (r) =>
          r.status === "rejected" ||
          (r.status === "fulfilled" && !r.value.success),
      ).length;
      const duration = Date.now() - startTime;

      this.logger.log(
        `⏰ === FETCH COMPLETED === ` +
          `Success: ${successCount}/3 | Failed: ${failureCount}/3 | Duration: ${duration}ms`,
      );

      if (successCount === 0) {
        this.logger.error(
          "🚨 CRITICAL: All scheduled fetches failed! Check API key and connectivity.",
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `❌ Unexpected error in scheduled fetch: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Helper: Log force fetch result (for forceFetchAndCache method)
   */
  private logForceFetchResult(
    category: string,
    result: PromiseSettledResult<{ success: boolean; error?: string }>,
  ) {
    if (result.status === "fulfilled" && result.value.success) {
      this.logger.log(`✅ ${category} force fetched successfully`);
    } else if (result.status === "fulfilled" && !result.value.success) {
      this.logger.error(
        `❌ ${category} force fetch failed: ${result.value.error}`,
      );
    } else if (result.status === "rejected") {
      this.logger.error(
        `❌ ${category} force fetch rejected: ${result.reason?.message || result.reason}`,
      );
    }
  }

  /**
   * Manual trigger for testing or admin panel
   */
  async triggerManualFetch(): Promise<{ success: boolean; message: string }> {
    this.logger.log("🔧 Manual fetch triggered");
    try {
      await this.fetchAllData();
      return { success: true, message: "Manual fetch completed" };
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
    const baseConfig = {
      enabled: this.configService.get<string>("SCHEDULER_ENABLED") === "true",
      useDynamicScheduling: this.useDynamicScheduling,
      nextRun: this.getNextRunTime(),
    };

    if (this.useDynamicScheduling) {
      return {
        ...baseConfig,
        type: "dynamic",
        currentPeriod: this.scheduleConfig.getCurrentSchedulePeriod(),
        currentInterval: this.scheduleConfig.getCurrentScheduleInterval(),
        tehranTime: this.scheduleConfig
          .getTehranTime()
          .format("YYYY-MM-DD HH:mm:ss"),
        isPeakHours: this.scheduleConfig.isCurrentlyPeakHours(),
        isWeekend: this.scheduleConfig.isCurrentlyWeekend(),
        minutesUntilPeriodChange:
          this.scheduleConfig.getMinutesUntilNextPeriodChange(),
      };
    } else {
      return {
        ...baseConfig,
        type: "static",
        intervalMinutes: this.configService.get<string>(
          "SCHEDULER_INTERVAL_MINUTES",
        ),
        cronExpression: this.configService.get<string>(
          "SCHEDULER_CRON_EXPRESSION",
        ),
        timezone: this.configService.get<string>("SCHEDULER_TIMEZONE"),
      };
    }
  }

  /**
   * Update scheduler interval at runtime (admin feature)
   */
  async updateInterval(newIntervalMinutes: number): Promise<void> {
    this.logger.log(
      `🔧 Updating scheduler interval to ${newIntervalMinutes} minutes`,
    );

    // Remove old job
    if (this.cronJob) {
      this.cronJob.stop();
      this.schedulerRegistry.deleteCronJob("navasan-dynamic-fetch");
    }

    // Create new job with new interval
    const timezone = this.configService.get<string>(
      "SCHEDULER_TIMEZONE",
      "UTC",
    );
    const cronExpression = this.intervalToCronExpression(newIntervalMinutes);

    this.cronJob = new CronJob(
      cronExpression,
      () => this.fetchAllData(),
      null,
      true,
      timezone,
    );

    this.schedulerRegistry.addCronJob("navasan-dynamic-fetch", this.cronJob);

    this.logger.log(
      `✅ Scheduler updated. Next run: ${this.getNextRunTime()?.toISOString()}`,
    );
  }
}
