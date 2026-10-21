import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { I18nProvider } from '@/components/i18n-provider';
import { SessionProvider } from '@/components/session-provider';
import { defaultLocale, isLocale, LOCALE_COOKIE } from '@/i18n/config';
import en from '@/i18n/en.json';

import './globals.css';

export const metadata: Metadata = {
  applicationName: en.app.name,
  title: en.app.name,
  description: en.app.tagline,
  icons: {
    icon: [{ url: '/brand/favicon.svg', type: 'image/svg+xml', sizes: 'any' }],
    shortcut: '/brand/favicon.svg',
    apple: [{ url: '/brand/logo-app-icon.svg', type: 'image/svg+xml' }],
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return (
    <html lang={locale}>
      <body>
        <I18nProvider initialLocale={locale}>
          <SessionProvider>{children}</SessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
