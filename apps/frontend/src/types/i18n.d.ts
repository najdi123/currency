/**
 * Type definitions for internationalization (i18n)
 * Provides type safety and autocomplete for translation keys
 */

import en from '../../messages/en.json';

type Messages = typeof en;

declare global {
  // Use type safe message keys with next-intl
  interface IntlMessages extends Messages {}
}
