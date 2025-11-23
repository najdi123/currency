/**
 * Utility to get actual current time from external API or calculated offset
 * Used when system clock cannot be trusted
 */

let cachedTehranTime: { date: Date; fetchedAt: number } | null = null;
const CACHE_DURATION = 60000; // 1 minute

/**
 * Calculate Tehran time from UTC using GMT+3:30 offset
 * This is a reliable fallback when APIs are unavailable
 */
function calculateTehranTimeFromUTC(): Date {
  const now = new Date();
  // Tehran is UTC+3:30 (3 hours and 30 minutes ahead)
  const utcTime = now.getTime();
  const tehranOffset = (3 * 60 + 30) * 60 * 1000; // 3.5 hours in milliseconds
  return new Date(utcTime + tehranOffset);
}

/**
 * Fetch actual current Tehran time with multiple fallbacks
 * Tries: WorldTimeAPI -> TimeAPI.io -> Calculated offset from UTC
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

  // Final fallback: Calculate from UTC offset
  console.warn('[TimeAPI] ⚠️ All APIs failed, using calculated UTC+3:30 offset');
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
