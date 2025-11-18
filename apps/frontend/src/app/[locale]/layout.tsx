// app/[locale]/layout.tsx
import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n/request';
import StoreProvider from "@/lib/StoreProvider";
import { OfflineBannerWrapper } from "@/components/OfflineBannerWrapper";
import { RateLimitWrapper } from "@/components/RateLimitWrapper";
import { ThemeProvider } from "next-themes";
import { validateConfig } from "@/lib/config";
import "../globals.css";

// Validate config at module load (server) – throws early if misconfigured
validateConfig();

// Professional Persian font - Vazirmatn Variable Font
// Supports Arabic and Latin scripts
const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-vazirmatn",
  weight: ["300", "400", "500", "600", "700", "800"],
});

// Dynamic metadata generation for internationalization
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        'en': '/en',
        'ar': '/ar',
        'fa': '/fa',
        'x-default': '/fa',
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      locale: locale,
      alternateLocale: ['en', 'ar', 'fa'].filter(l => l !== locale),
      type: 'website',
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // Ensure locale is valid
  if (!locales.includes(locale as any)) {
    notFound();
  }

  // Get all messages for client-side
  const messages = await getMessages();

  // Determine text direction based on locale
  const direction = locale === 'ar' || locale === 'fa' ? 'rtl' : 'ltr';

  return (
    <html
      lang={locale}
      dir={direction}
      className={vazirmatn.variable}
      suppressHydrationWarning
    >
      <body
        className={`${vazirmatn.className} antialiased`}
        // Seed Apple-like tokens as defaults
        style={{
          background: "var(--background-base)",
          color: "rgb(var(--text-primary))",
        }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          enableColorScheme // ✅ better native form/control theming
          disableTransitionOnChange // ✅ avoid flicker when toggling
        >
          <NextIntlClientProvider messages={messages}>
            <StoreProvider>
              <RateLimitWrapper>
                <OfflineBannerWrapper />
                {children}
              </RateLimitWrapper>
            </StoreProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

// Generate static params for all locales
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
