/**
 * Date utility functions for Tehran timezone handling
 * All dates in the system use Tehran timezone (Asia/Tehran, UTC+3:30)
 */

import { BadRequestException } from "@nestjs/common";

/**
 * Tehran timezone identifier
 */
export const TEHRAN_TIMEZONE = "Asia/Tehran";

/**
 * Parse a YYYY-MM-DD date string and return Date object in Tehran timezone
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object representing start of day in Tehran timezone
 * @throws BadRequestException if format is invalid
 */
export function parseTehranDate(dateStr: string): Date {
  // Strict format validation
  const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = dateStr.match(datePattern);

  if (!match) {
    throw new BadRequestException(
      "Invalid date format. Use YYYY-MM-DD (e.g., 2025-01-15)",
    );
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  // Validate ranges
  if (month < 1 || month > 12) {
    throw new BadRequestException(
      `Invalid month: ${month}. Month must be between 1 and 12.`,
    );
  }

  if (day < 1 || day > 31) {
    throw new BadRequestException(
      `Invalid day: ${day}. Day must be between 1 and 31.`,
    );
  }

  // Create date in UTC and validate it's a real date
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  // Check if date rolled over (e.g., Feb 31 becomes Mar 3)
  if (
    date.getUTCDate() !== day ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCFullYear() !== year
  ) {
    throw new BadRequestException(
      `Invalid date: ${dateStr}. This date does not exist in the calendar.`,
    );
  }

  return date;
}

/**
 * Get the current date in Tehran timezone
 * @returns Date object representing start of today in Tehran
 */
export function getTehranToday(): Date {
  const now = new Date();

  // Get Tehran date components
  const tehranDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: TEHRAN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  // Parse as YYYY-MM-DD and return
  return parseTehranDate(tehranDateStr);
}

/**
 * Get start of day (00:00:00) for a date in Tehran timezone
 * @param date - The date to get start of day for
 * @returns Date object with time set to 00:00:00 Tehran time
 */
export function getTehranStartOfDay(date: Date): Date {
  // Get Tehran date string
  const tehranDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: TEHRAN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  const [year, month, day] = tehranDateStr.split("-").map(Number);

  // Create date at start of day in Tehran
  // Tehran is UTC+3:30, so we need to calculate UTC equivalent
  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  // Adjust for Tehran offset (subtract 3h 30m to get UTC equivalent)
  utcDate.setUTCHours(utcDate.getUTCHours() - 3);
  utcDate.setUTCMinutes(utcDate.getUTCMinutes() - 30);

  return utcDate;
}

/**
 * Get end of day (23:59:59.999) for a date in Tehran timezone
 * @param date - The date to get end of day for
 * @returns Date object with time set to 23:59:59.999 Tehran time
 */
export function getTehranEndOfDay(date: Date): Date {
  const startOfDay = getTehranStartOfDay(date);

  // Add 23h 59m 59s 999ms
  return new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/**
 * Format a date as YYYY-MM-DD in Tehran timezone
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatTehranDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TEHRAN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Validate that a date is not older than maxDays
 * @param date - Date to validate
 * @param maxDays - Maximum age in days
 * @returns Error message if invalid, null if valid
 */
export function validateDateAge(date: Date, maxDays: number): string | null {
  const today = getTehranToday();
  const ageInMs = today.getTime() - date.getTime();
  const ageInDays = Math.floor(ageInMs / (24 * 60 * 60 * 1000));

  if (ageInDays > maxDays) {
    return `Date is too old. Historical data is only available for the last ${maxDays} days.`;
  }

  if (ageInMs < 0) {
    return "Date cannot be in the future.";
  }

  return null;
}

/**
 * Get date range boundaries for querying OHLC data
 * Returns UTC timestamps for database queries
 * @param date - Target date in Tehran timezone
 * @returns Object with start and end timestamps
 */
export function getTehranDayBoundaries(date: Date): {
  startOfDay: Date;
  endOfDay: Date;
} {
  const tehranDateStr = formatTehranDate(date);
  const [year, month, day] = tehranDateStr.split("-").map(Number);

  // Create precise boundaries in UTC
  // Tehran is UTC+3:30, so midnight Tehran = 20:30 previous day UTC
  const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  startOfDay.setUTCHours(startOfDay.getUTCHours() - 3);
  startOfDay.setUTCMinutes(startOfDay.getUTCMinutes() - 30);

  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCHours(endOfDay.getUTCHours() + 23);
  endOfDay.setUTCMinutes(endOfDay.getUTCMinutes() + 59);
  endOfDay.setUTCSeconds(59);
  endOfDay.setUTCMilliseconds(999);

  return { startOfDay, endOfDay };
}
