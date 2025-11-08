/**
 * Date utility functions for data freshness indicators
 * Provides age calculations and relative time formatting with i18n support
 */

export interface DataAge {
  isFresh: boolean;
  isStale: boolean;
  ageMinutes: number;
}

/**
 * Calculate the age of data based on a timestamp
 * @param timestamp - ISO date string or Date object
 * @returns Object with freshness status and age in minutes
 */
export const getDataAge = (timestamp: string | Date): DataAge => {
  const now = Date.now();
  const updated = new Date(timestamp).getTime();
  const ageMinutes = (now - updated) / 1000 / 60;

  return {
    isFresh: ageMinutes < 60, // Less than 1 hour = fresh
    isStale: ageMinutes > 1440, // More than 24 hours = stale
    ageMinutes
  };
};

/**
 * Get a human-readable relative time string with localization
 * @param timestamp - ISO date string or Date object
 * @param t - Translation function from next-intl
 * @returns Formatted localized string (e.g., "5 minutes ago", "5 دقیقه پیش")
 */
export const getRelativeTime = (
  timestamp: string | Date,
  t: (key: string, values?: Record<string, any>) => string
): string => {
  const age = getDataAge(timestamp);

  if (age.ageMinutes < 1) return t('Time.now');
  if (age.ageMinutes < 60) {
    const mins = Math.floor(age.ageMinutes);
    return t('Time.minutesAgo', { count: mins });
  }
  if (age.ageMinutes < 1440) {
    const hours = Math.floor(age.ageMinutes / 60);
    return t('Time.hoursAgo', { count: hours });
  }
  const days = Math.floor(age.ageMinutes / 1440);
  return t('Time.daysAgo', { count: days });
};

/**
 * Format absolute date and time with locale support
 * @param timestamp - ISO date string or Date object
 * @param locale - Locale string (e.g., 'en', 'fa', 'ar')
 * @param includeTime - Whether to include time (default: true)
 * @returns Formatted date string
 */
export const formatAbsoluteDate = (
  timestamp: string | Date,
  locale: string = 'en',
  includeTime: boolean = true
): string => {
  const date = new Date(timestamp);

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }

  return new Intl.DateTimeFormat(locale, options).format(date);
};

/**
 * Format date for display with both relative and absolute
 * @param timestamp - ISO date string or Date object
 * @param t - Translation function from next-intl
 * @param locale - Locale string (e.g., 'en', 'fa', 'ar')
 * @returns Object with both relative and absolute formatted dates
 */
export const formatDate = (
  timestamp: string | Date,
  t: (key: string, values?: Record<string, any>) => string,
  locale: string = 'en'
): {
  relative: string;
  absolute: string;
} => {
  return {
    relative: getRelativeTime(timestamp, t),
    absolute: formatAbsoluteDate(timestamp, locale),
  };
};

/**
 * Format date in Persian calendar (Jalali)
 * Note: This is a simple implementation. For full Persian calendar support,
 * consider using a library like 'moment-jalaali'
 * @param timestamp - ISO date string or Date object
 * @param locale - Locale string (e.g., 'fa')
 * @returns Formatted Persian date string (currently returns Gregorian)
 */
export const formatPersianDate = (timestamp: string | Date, locale: string = 'fa'): string => {
  // For now, return Gregorian format
  // You can integrate a Persian calendar library here if needed
  return formatAbsoluteDate(timestamp, locale, true);
};
