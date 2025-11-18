'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { locales } from '@/i18n/request';
import { FiCheck } from 'react-icons/fi';

const languageNames: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  fa: 'فارسی',
};

// cn utility for conditional classes
const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter((c) => typeof c === 'string' && c.length > 0).join(' ')
}

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  // Memoize the handler to prevent recreation on every render
  const handleChange = useCallback((newLocale: string) => {
    const pathWithoutLocale = pathname.replace(`/${locale}`, '');
    const newPath = `/${newLocale}${pathWithoutLocale}`;
    router.push(newPath);
    router.refresh();
  }, [locale, pathname, router]);

  return (
    <div className="space-y-2" role="radiogroup" aria-label="Select Language">
      {locales.map((loc) => (
        <button
          key={loc}
          onClick={() => handleChange(loc)}
          type="button"
          role="radio"
          aria-checked={locale === loc}
          aria-label={`Switch to ${languageNames[loc]}`}
          className={cn(
            "w-full flex items-center justify-between px-4 py-3.5 rounded-lg border transition-colors",
            "active-scale-apple focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
            locale === loc
              ? 'bg-accent text-white border-accent'
              : 'bg-bg-base hover:bg-bg-secondary border-border-light text-text-primary'
          )}
        >
          <span className="font-medium text-apple-body">{languageNames[loc]}</span>
          {locale === loc && <FiCheck className="w-5 h-5" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}
