import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import moment from "moment-timezone";

/**
 * Schedule Configuration for Dynamic Scheduling
 *
 * This service determines the optimal data fetch interval based on:
 * - Time of day (peak hours vs normal hours)
 * - Day of week (weekdays vs weekends)
 * - Tehran timezone (where the market operates)
 *
 * Default Schedule:
 * - Peak Hours (Mon-Wed, 8 AM - 2 PM Tehran): Every 10 minutes
 * - Normal Hours (Mon-Wed, other times): Every 60 minutes
 * - Weekends (Thu-Fri): Every 120 minutes
 *
 * Configuration can be overridden via environment variables:
 * - SCHEDULER_PEAK_INTERVAL: Peak hours interval (default: 10)
 * - SCHEDULER_NORMAL_INTERVAL: Normal hours interval (default: 60)
 * - SCHEDULER_WEEKEND_INTERVAL: Weekend interval (default: 120)
 * - SCHEDULER_PEAK_START_HOUR: Peak start hour (default: 8)
 * - SCHEDULER_PEAK_END_HOUR: Peak end hour (default: 14)
 * - SCHEDULER_TIMEZONE: Timezone for scheduling (default: Asia/Tehran)
 */

export interface ScheduleConfig {
  peakHours: {
    days: number[]; // 0 = Sunday, 1 = Monday, etc.
    startHour: number; // 24-hour format
    endHour: number; // 24-hour format
    interval: number; // minutes
  };
  normalHours: {
    days: number[];
    interval: number; // minutes
  };
  weekendHours: {
    days: number[];
    interval: number; // minutes
  };
  timezone: string;
}

@Injectable()
export class ScheduleConfigService {
  private readonly logger = new Logger(ScheduleConfigService.name);
  private config: ScheduleConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfiguration();
    this.logger.log("📅 Schedule Configuration loaded:");
    this.logger.log(`   Timezone: ${this.config.timezone}`);
    this.logger.log(
      `   Peak Hours: Mon-Wed ${this.config.peakHours.startHour}:00-${this.config.peakHours.endHour}:00 (${this.config.peakHours.interval}m)`,
    );
    this.logger.log(
      `   Normal Hours: Mon-Wed (${this.config.normalHours.interval}m)`,
    );
    this.logger.log(
      `   Weekends: Thu-Fri (${this.config.weekendHours.interval}m)`,
    );
  }

  /**
   * Load schedule configuration from environment or use defaults
   */
  private loadConfiguration(): ScheduleConfig {
    return {
      peakHours: {
        days: [1, 2, 3], // Monday, Tuesday, Wednesday
        startHour: parseInt(
          this.configService.get("SCHEDULER_PEAK_START_HOUR", "8"),
          10,
        ),
        endHour: parseInt(
          this.configService.get("SCHEDULER_PEAK_END_HOUR", "14"),
          10,
        ),
        interval: parseInt(
          this.configService.get("SCHEDULER_PEAK_INTERVAL", "10"),
          10,
        ),
      },
      normalHours: {
        days: [1, 2, 3], // Monday, Tuesday, Wednesday
        interval: parseInt(
          this.configService.get("SCHEDULER_NORMAL_INTERVAL", "60"),
          10,
        ),
      },
      weekendHours: {
        days: [4, 5], // Thursday, Friday (Iranian weekend)
        interval: parseInt(
          this.configService.get("SCHEDULER_WEEKEND_INTERVAL", "120"),
          10,
        ),
      },
      timezone: this.configService.get("SCHEDULER_TIMEZONE", "Asia/Tehran"),
    };
  }

  /**
   * Get the current schedule interval in minutes based on current time and day
   *
   * @returns Interval in minutes
   */
  getCurrentScheduleInterval(): number {
    const now = moment().tz(this.config.timezone);
    const hour = now.hour();
    const dayOfWeek = now.day(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Check if it's a weekend day
    if (this.config.weekendHours.days.includes(dayOfWeek)) {
      this.logger.debug(
        `🌴 Weekend detected (day ${dayOfWeek}), using ${this.config.weekendHours.interval}m interval`,
      );
      return this.config.weekendHours.interval;
    }

    // Check if it's during peak hours
    if (
      this.config.peakHours.days.includes(dayOfWeek) &&
      hour >= this.config.peakHours.startHour &&
      hour < this.config.peakHours.endHour
    ) {
      this.logger.debug(
        `⚡ Peak hours detected (${hour}:00), using ${this.config.peakHours.interval}m interval`,
      );
      return this.config.peakHours.interval;
    }

    // Normal hours (weekday, non-peak)
    this.logger.debug(
      `🕐 Normal hours (day ${dayOfWeek}, ${hour}:00), using ${this.config.normalHours.interval}m interval`,
    );
    return this.config.normalHours.interval;
  }

  /**
   * Calculate the next scheduled time based on current interval
   *
   * @returns Date object of next scheduled execution
   */
  getNextScheduledTime(): Date {
    const intervalMinutes = this.getCurrentScheduleInterval();
    return moment()
      .tz(this.config.timezone)
      .add(intervalMinutes, "minutes")
      .toDate();
  }

  /**
   * Get human-readable description of current schedule period
   *
   * @returns String description (e.g., "Peak Hours", "Weekend", "Normal Hours")
   */
  getCurrentSchedulePeriod(): string {
    const now = moment().tz(this.config.timezone);
    const hour = now.hour();
    const dayOfWeek = now.day();

    if (this.config.weekendHours.days.includes(dayOfWeek)) {
      return "Weekend";
    }

    if (
      this.config.peakHours.days.includes(dayOfWeek) &&
      hour >= this.config.peakHours.startHour &&
      hour < this.config.peakHours.endHour
    ) {
      return "Peak Hours";
    }

    return "Normal Hours";
  }

  /**
   * Get current Tehran time
   *
   * @returns Moment object in Tehran timezone
   */
  getTehranTime(): moment.Moment {
    return moment().tz(this.config.timezone);
  }

  /**
   * Get full schedule configuration (for admin panel / debugging)
   *
   * @returns Complete schedule configuration object
   */
  getConfiguration(): ScheduleConfig {
    return { ...this.config };
  }

  /**
   * Update schedule configuration at runtime
   * (Admin feature - requires restart to persist)
   *
   * @param newConfig Partial configuration to update
   */
  updateConfiguration(newConfig: Partial<ScheduleConfig>): void {
    this.logger.warn("⚠️  Updating schedule configuration at runtime");
    this.config = { ...this.config, ...newConfig };
    this.logger.log("✅ Schedule configuration updated successfully");
  }

  /**
   * Check if currently in peak hours
   *
   * @returns True if in peak hours, false otherwise
   */
  isCurrentlyPeakHours(): boolean {
    const now = moment().tz(this.config.timezone);
    const hour = now.hour();
    const dayOfWeek = now.day();

    return (
      this.config.peakHours.days.includes(dayOfWeek) &&
      hour >= this.config.peakHours.startHour &&
      hour < this.config.peakHours.endHour
    );
  }

  /**
   * Check if currently weekend
   *
   * @returns True if weekend, false otherwise
   */
  isCurrentlyWeekend(): boolean {
    const now = moment().tz(this.config.timezone);
    const dayOfWeek = now.day();
    return this.config.weekendHours.days.includes(dayOfWeek);
  }

  /**
   * Get time until next schedule period change
   *
   * @returns Minutes until schedule period changes
   */
  getMinutesUntilNextPeriodChange(): number {
    const now = moment().tz(this.config.timezone);
    const hour = now.hour();
    const dayOfWeek = now.day();

    // If in peak hours, calculate minutes until peak hours end
    if (this.isCurrentlyPeakHours()) {
      const peakEndTime = moment()
        .tz(this.config.timezone)
        .hour(this.config.peakHours.endHour)
        .minute(0)
        .second(0);

      return peakEndTime.diff(now, "minutes");
    }

    // If on weekend, calculate minutes until Monday
    if (this.isCurrentlyWeekend()) {
      const nextMonday = moment()
        .tz(this.config.timezone)
        .day(1) // Monday
        .hour(this.config.peakHours.startHour)
        .minute(0)
        .second(0);

      // If Monday is in the past, add 7 days
      if (nextMonday.isBefore(now)) {
        nextMonday.add(7, "days");
      }

      return nextMonday.diff(now, "minutes");
    }

    // Normal hours on weekday - calculate minutes until peak hours start
    const nextPeakStart = moment()
      .tz(this.config.timezone)
      .hour(this.config.peakHours.startHour)
      .minute(0)
      .second(0);

    // If peak start is in the past today, calculate for tomorrow
    if (nextPeakStart.isBefore(now)) {
      nextPeakStart.add(1, "day");
    }

    return nextPeakStart.diff(now, "minutes");
  }
}
