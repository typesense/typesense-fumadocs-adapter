import { RootProvider } from 'fumadocs-ui/provider/next';
import { Inter } from 'next/font/google';
import TypesenseSearchDialog from '@/components/search';
import '../global.css';
import { defineI18nUI } from 'fumadocs-ui/i18n';
import { i18n } from '@/lib/i18n';

const inter = Inter({
  subsets: ['latin'],
});

const { provider } = defineI18nUI(i18n, {
  translations: {
    en: {
      displayName: 'English',
    },
    vi: {
      displayName: 'Vietnamese',
      search: 'Tìm kiếm',
    },
  },
});

export default async function RootLayout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: React.ReactNode;
}) {
  const lang = (await params).lang;
  return (
    <html lang='en' className={inter.className} suppressHydrationWarning>
      <body className='flex flex-col min-h-screen'>
        <RootProvider
          i18n={provider(lang)}
          search={{ SearchDialog: TypesenseSearchDialog }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
