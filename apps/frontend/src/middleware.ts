import createMiddleware from 'next-intl/middleware';
import { locales } from './i18n/request';

export default createMiddleware({
  // List of all supported locales
  locales,

  // Default locale when browser language doesn't match
  defaultLocale: 'fa', // Keep Farsi as default since app is currently Farsi

  // Always use prefix for locale (e.g., /en, /ar, /fa)
  localePrefix: 'always',

  // Automatically detect browser language
  localeDetection: true,
});

export const config = {
  // Match all pathnames except API routes, static files, etc.
  matcher: ['/', '/(ar|en|fa)/:path*'],
};
