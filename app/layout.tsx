import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Shift Team Calendar - Jadwal Kerja Cupertino',
  description: 'iOS-style real-time work shift management calendar synced with Google Sheets.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${inter.variable} ${plusJakartaSans.variable}`}>
      <body className="antialiased bg-[#f2f2f7] dark:bg-black text-zinc-900 dark:text-zinc-100 min-h-screen font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
