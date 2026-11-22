import type { Metadata, Viewport } from 'next';
import { Heebo } from 'next/font/google';
import { I18nProvider } from '@/lib/i18n';
import './globals.css';

const heebo = Heebo({ subsets: ['hebrew', 'latin'], variable: '--font-heebo' });

export const metadata: Metadata = {
  title: 'טבלת צ׳באק',
  description: 'מעלים סצנה ומקבלים קובץ Word עם טבלת עבודה בשיטת צ׳באק. הכול קורה במכשיר שלך.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0e1014' };

// Sets the direction before the page is painted, so English users do not see a flash of right-to-left.
const initLang = `try{if(localStorage.getItem('lang')==='en'){var d=document.documentElement;d.lang='en';d.dir='ltr'}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initLang }} />
      </head>
      <body className="font-sans antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
