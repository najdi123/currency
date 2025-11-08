/**
 * Hook to get the text direction based on current locale
 * Returns 'rtl' for Arabic and Persian, 'ltr' for English
 */

'use client';

import { useLocale } from 'next-intl';

export function useDirection(): 'ltr' | 'rtl' {
  const locale = useLocale();
  return locale === 'ar' || locale === 'fa' ? 'rtl' : 'ltr';
}
