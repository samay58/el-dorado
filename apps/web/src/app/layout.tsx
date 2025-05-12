import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css'; // Assuming Tailwind directives are in here
import Header from '@/components/layout/Header'; // Using alias @ for src
import { ThemeProvider } from '@/contexts/ThemeContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SF Real Estate Scorer',
  description: 'Discover and evaluate San Francisco real estate listings.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 min-h-screen flex flex-col`}>
        <ThemeProvider>
          <Header />
          <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
          <footer className="text-center p-4 text-neutral-500 dark:text-neutral-400 text-sm border-t border-neutral-200 dark:border-neutral-700">
            © {new Date().getFullYear()} SF Real Estate Scorer. All rights reserved.
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
} 