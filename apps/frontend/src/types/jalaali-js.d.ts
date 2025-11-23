declare module 'jalaali-js' {
  export interface JalaaliDate {
    jy: number // Jalaali year
    jm: number // Jalaali month
    jd: number // Jalaali day
  }

  export interface GregorianDate {
    gy: number // Gregorian year
    gm: number // Gregorian month
    gd: number // Gregorian day
  }

  /**
   * Convert Jalaali (Persian) date to Gregorian date
   * @param jy - Jalaali year
   * @param jm - Jalaali month (1-12)
   * @param jd - Jalaali day (1-31)
   * @returns Gregorian date object
   */
  export function toGregorian(jy: number, jm: number, jd: number): GregorianDate

  /**
   * Convert Gregorian date to Jalaali (Persian) date
   * @param gy - Gregorian year
   * @param gm - Gregorian month (1-12)
   * @param gd - Gregorian day (1-31)
   * @returns Jalaali date object
   */
  export function toJalaali(gy: number, gm: number, gd: number): JalaaliDate

  /**
   * Check if a Jalaali year is leap year
   * @param jy - Jalaali year
   * @returns true if leap year, false otherwise
   */
  export function isLeapJalaaliYear(jy: number): boolean

  /**
   * Get number of days in a Jalaali month
   * @param jy - Jalaali year
   * @param jm - Jalaali month (1-12)
   * @returns Number of days in the month
   */
  export function jalaaliMonthLength(jy: number, jm: number): number

  /**
   * Check if a Jalaali date is valid
   * @param jy - Jalaali year
   * @param jm - Jalaali month (1-12)
   * @param jd - Jalaali day (1-31)
   * @returns true if valid, false otherwise
   */
  export function isValidJalaaliDate(jy: number, jm: number, jd: number): boolean
}
