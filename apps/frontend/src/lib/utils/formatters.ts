/**
 * Convert Western (Arabic) numerals to Persian/Farsi numerals
 * Maps 0-9 to ۰-۹
 */
export function toPersianDigits(str: string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return str.replace(/\d/g, (digit) => persianDigits[parseInt(digit)])
}

/**
 * Format a number or string as Toman currency with comma separators
 * @param value - The value to format (number or string)
 * @param locale - Locale for number formatting (default: 'en-US')
 * @returns Formatted string with commas (e.g., "106,850" or "۱۰۶,۸۵۰" for Persian)
 */
export function formatToman(value: string | number | undefined | null, locale?: string): string {
  if (value === undefined || value === null) return locale === 'fa' ? '۰' : '0'

  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) return locale === 'fa' ? '۰' : '0'

  const formatted = new Intl.NumberFormat('en-US').format(Math.round(num))

  return locale === 'fa' ? toPersianDigits(formatted) : formatted
}

/**
 * Format a change amount in Toman with Persian scale units
 * @param change - The change amount in Toman
 * @param locale - Locale for number formatting (default: 'fa')
 * @returns Formatted string with +/- sign and scale (e.g., "+2.5 میلیون تومان", "-800 هزار تومان")
 *
 * Formatting rules (Persian convention):
 * - Under 1,000: Exact number (e.g., "+850 تومان" or "+۸۵۰ تومان" for Persian)
 * - 1,000 - 999,999: "هزار تومان" with up to 1 decimal (e.g., "+12.5 هزار تومان" or "+۱۲.۵ هزار تومان")
 * - 1,000,000 - 999,999,999: "میلیون تومان" with up to 2 decimals (e.g., "+2.31 میلیون تومان" or "+۲.۳۱ میلیون تومان")
 * - 1 billion+: "میلیارد تومان" with up to 2 decimals (e.g., "+12.13 میلیارد تومان" or "+۱۲.۱۳ میلیارد تومان")
 */
export function formatChange(change: number | undefined | null, locale?: string): string {
  if (change === undefined || change === null || change === 0) {
    return locale === 'fa' ? '۰ تومان' : '0 تومان'
  }

  const sign = change > 0 ? '+' : '-'
  const absNum = Math.abs(change)

  // Under 1,000: show exact number
  if (absNum < 1000) {
    const formatted = new Intl.NumberFormat('en-US').format(Math.round(absNum))
    const number = locale === 'fa' ? toPersianDigits(formatted) : formatted
    return `${sign}${number} تومان`
  }

  // 1,000 - 999,999: use "هزار تومان" (thousand)
  if (absNum < 1_000_000) {
    const thousands = absNum / 1000
    const formatted = thousands % 1 === 0
      ? thousands.toFixed(0)
      : thousands.toFixed(1)
    const number = new Intl.NumberFormat('en-US').format(parseFloat(formatted))
    const finalNumber = locale === 'fa' ? toPersianDigits(number) : number
    return `${sign}${finalNumber} هزار تومان`
  }

  // 1,000,000 - 999,999,999: use "میلیون تومان" (million)
  if (absNum < 1_000_000_000) {
    const millions = absNum / 1_000_000
    const formatted = millions % 1 === 0
      ? millions.toFixed(0)
      : millions < 10
        ? millions.toFixed(2) // More precision for single-digit millions
        : millions.toFixed(1) // Less precision for larger numbers
    const number = new Intl.NumberFormat('en-US').format(parseFloat(formatted))
    const finalNumber = locale === 'fa' ? toPersianDigits(number) : number
    return `${sign}${finalNumber} میلیون تومان`
  }

  // 1 billion+: use "میلیارد تومان" (billion)
  const billions = absNum / 1_000_000_000
  const formatted = billions % 1 === 0
    ? billions.toFixed(0)
    : billions < 10
      ? billions.toFixed(2)
      : billions.toFixed(1)
  const number = new Intl.NumberFormat('en-US').format(parseFloat(formatted))
  const finalNumber = locale === 'fa' ? toPersianDigits(number) : number
  return `${sign}${finalNumber} میلیارد تومان`
}

/**
 * Format a change amount as separate parts for custom layout
 * @param change - The change amount in Toman
 * @param locale - Locale for number formatting (default: 'fa')
 * @param translations - Optional translation object with toman, thousandToman, millionToman, billionToman keys
 * @returns Object with label (localized text), sign, and formatted number
 */
export function formatChangeParts(
  change: number | undefined | null,
  locale?: string,
  translations?: {
    toman: string
    thousandToman: string
    millionToman: string
    billionToman: string
  }
): {
  label: string
  signedNumber: string
} {
  // Default to Persian labels if no translations provided (for backwards compatibility)
  const labels = translations || {
    toman: 'تومان',
    thousandToman: 'هزار تومان',
    millionToman: 'میلیون تومان',
    billionToman: 'میلیارد تومان'
  }

  if (change === undefined || change === null || change === 0) {
    return { label: labels.toman, signedNumber: locale === 'fa' ? '۰' : '0' }
  }

  const sign = change > 0 ? '+' : '-'
  const absNum = Math.abs(change)

  // Under 1,000: show exact number
  if (absNum < 1000) {
    const formatted = new Intl.NumberFormat('en-US').format(Math.round(absNum))
    const number = locale === 'fa' ? toPersianDigits(formatted) : formatted
    return {
      label: labels.toman,
      signedNumber: `${sign}${number}`
    }
  }

  // 1,000 - 999,999: use "thousand Toman"
  if (absNum < 1_000_000) {
    const thousands = absNum / 1000
    const formatted = thousands % 1 === 0
      ? thousands.toFixed(0)
      : thousands.toFixed(1)
    const number = new Intl.NumberFormat('en-US').format(parseFloat(formatted))
    const finalNumber = locale === 'fa' ? toPersianDigits(number) : number
    return {
      label: labels.thousandToman,
      signedNumber: `${sign}${finalNumber}`
    }
  }

  // 1,000,000 - 999,999,999: use "million Toman"
  if (absNum < 1_000_000_000) {
    const millions = absNum / 1_000_000
    const formatted = millions % 1 === 0
      ? millions.toFixed(0)
      : millions < 10
        ? millions.toFixed(2)
        : millions.toFixed(1)
    const number = new Intl.NumberFormat('en-US').format(parseFloat(formatted))
    const finalNumber = locale === 'fa' ? toPersianDigits(number) : number
    return {
      label: labels.millionToman,
      signedNumber: `${sign}${finalNumber}`
    }
  }

  // 1 billion+: use "billion Toman"
  const billions = absNum / 1_000_000_000
  const formatted = billions % 1 === 0
    ? billions.toFixed(0)
    : billions < 10
      ? billions.toFixed(2)
      : billions.toFixed(1)
  const number = new Intl.NumberFormat('en-US').format(parseFloat(formatted))
  const finalNumber = locale === 'fa' ? toPersianDigits(number) : number
  return {
    label: labels.billionToman,
    signedNumber: `${sign}${finalNumber}`
  }
}

/**
 * Get the appropriate color class for a change value
 * @param change - The change amount
 * @returns Tailwind CSS color class
 */
export function getChangeColor(change: number | undefined | null): string {
  if (change === undefined || change === null || change === 0) return 'text-gray-600'

  return change > 0 ? 'text-green-600' : 'text-red-600'
}
