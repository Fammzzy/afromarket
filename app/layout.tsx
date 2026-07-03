import './globals.css';
import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import NextTopLoader from 'nextjs-toploader';

export const metadata: Metadata = {
  title: 'AgriMarket — Smarter Farming, Brighter Future',
  description: 'An AI-powered marketplace where farmers and buyers connect. Buy, sell, and grow with intelligent insights.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NextTopLoader showSpinner={false} color="hsl(152, 63%, 25%)" height={3} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
