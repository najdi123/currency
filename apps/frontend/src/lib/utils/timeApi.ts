/**
 * Utility to get actual current time from external API or calculated offset
 * Used when system clock cannot be trusted
 */

let cachedTehranTime: { date: Date; fetchedAt: number } | null = null;
const CACHE_DURATION = 60000; // 1 minute

/**
 * Calculate Tehran time using browser's Intl API
 * This automatically handles Daylight Saving Time (IRST/IRDT)
 * - Winter (Standard Time): UTC+3:30 (IRST)
 * - Summer (Daylight Time): UTC+4:30 (IRDT)
 * This is a reliable fallback when APIs are unavailable
 */
function calculateTehranTimeFromUTC(): Date {
  const now = new Date();

  // Use Intl.DateTimeFormat to get Tehran time components
  // This automatically handles DST transitions
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const dateParts: Record<string, string> = {};

  parts.forEach((part) => {
    if (part.type !== 'literal') {
      dateParts[part.type] = part.value;
    }
  });

  // Construct Tehran time as a Date object
  const tehranTime = new Date(
    parseInt(dateParts.year),
    parseInt(dateParts.month) - 1,
    parseInt(dateParts.day),
    parseInt(dateParts.hour),
    parseInt(dateParts.minute),
    parseInt(dateParts.second)
  );

  return tehranTime;
}

/**
 * Fetch actual current Tehran time with multiple fallbacks
 * Tries: WorldTimeAPI -> TimeAPI.io -> Browser's Intl API (with DST support)
 */
export async function fetchTehranTime(): Promise<Date> {
  // Return cached time if available and fresh
  if (cachedTehranTime) {
    const age = Date.now() - cachedTehranTime.fetchedAt;
    if (age < CACHE_DURATION) {
      // Add elapsed time to cached date
      return new Date(cachedTehranTime.date.getTime() + age);
    }
  }

  // Try WorldTimeAPI
  try {
    const response = await fetch('https://worldtimeapi.org/api/timezone/Asia/Tehran', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      const tehranTime = new Date(data.datetime);

      // Cache the result
      cachedTehranTime = {
        date: tehranTime,
        fetchedAt: Date.now(),
      };

      console.log('[TimeAPI] ✅ Got time from WorldTimeAPI');
      return tehranTime;
    }
  } catch (error) {
    console.warn('[TimeAPI] WorldTimeAPI failed:', error);
  }

  // Try TimeAPI.io as second fallback
  try {
    const response = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=Asia/Tehran', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      const tehranTime = new Date(data.dateTime);

      // Cache the result
      cachedTehranTime = {
        date: tehranTime,
        fetchedAt: Date.now(),
      };

      console.log('[TimeAPI] ✅ Got time from TimeAPI.io');
      return tehranTime;
    }
  } catch (error) {
    console.warn('[TimeAPI] TimeAPI.io failed:', error);
  }

  // Final fallback: Calculate using browser's Intl API
  console.warn('[TimeAPI] ⚠️ All APIs failed, using browser Intl API (with DST support)');
  const calculatedTime = calculateTehranTimeFromUTC();

  // Cache even the calculated time
  cachedTehranTime = {
    date: calculatedTime,
    fetchedAt: Date.now(),
  };

  return calculatedTime;
}

/**
 * Get Tehran date (without time) from cached or fetched time
 */
export async function getTehranDateFromApi(): Promise<Date> {
  const tehranTime = await fetchTehranTime();

  // Format to YYYY-MM-DD in Tehran timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const dateStr = formatter.format(tehranTime);
  const [year, month, day] = dateStr.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}
