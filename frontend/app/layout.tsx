import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/app/components/Navbar';

export const metadata: Metadata = {
  title: 'Prowider — Lead Distribution',
  description: 'Smart lead distribution platform for service providers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50" suppressHydrationWarning>
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
