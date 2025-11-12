/**
 * Utility to get actual current time from external API
 * Used when system clock cannot be trusted
 */

let cachedTehranTime: { date: Date; fetchedAt: number } | null = null;
const CACHE_DURATION = 60000; // 1 minute

/**
 * Fetch actual current Tehran time from World Time API
 * Falls back to system time if API fails
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

  try {
    // Fetch from World Time API
    const response = await fetch('https://worldtimeapi.org/api/timezone/Asia/Tehran', {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('World Time API request failed');
    }

    const data = await response.json();
    const tehranTime = new Date(data.datetime);

    // Cache the result
    cachedTehranTime = {
      date: tehranTime,
      fetchedAt: Date.now(),
    };

    return tehranTime;
  } catch (error) {
    console.warn('Failed to fetch Tehran time from API, falling back to system time:', error);
    // Fallback to system time
    return new Date();
  }
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
