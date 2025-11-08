'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { locales } from '@/i18n/request';

const languageNames: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  fa: 'فارسی',
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: string) => {
    const pathWithoutLocale = pathname.replace(`/${locale}`, '');
    const newPath = `/${newLocale}${pathWithoutLocale}`;
    router.push(newPath);
    router.refresh();
  };

  return (
    <div className="space-y-2">
      {locales.map((loc) => (
        <button
          key={loc}
          onClick={() => handleChange(loc)}
          className={`w-full text-right px-4 py-3 rounded-lg border transition-colors ${
            locale === loc
              ? 'bg-accent text-white border-accent'
              : 'bg-bg-base hover:bg-bg-secondary border-border-light text-text-primary'
          }`}
        >
          <span className="font-medium">{languageNames[loc]}</span>
        </button>
      ))}
    </div>
  );
}
