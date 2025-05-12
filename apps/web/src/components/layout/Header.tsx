import Link from 'next/link';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function Header() {
  return (
    <header className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white p-4 shadow-sm dark:shadow-md">
      <nav className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold hover:text-brand-500 dark:hover:text-sky-400 transition-colors">
          SF Real Estate Scorer
        </Link>
        <ul className="flex space-x-6 items-center">
          <li>
            <Link href="/dashboard" className="hover:text-brand-500 dark:hover:text-sky-400 transition-colors">
              Dashboard
            </Link>
          </li>
          <li>
            <Link href="/map" className="hover:text-brand-500 dark:hover:text-sky-400 transition-colors">
              Map
            </Link>
          </li>
          <li>
            <ThemeToggle />
          </li>
          {/* Add more navigation links here if needed */}
        </ul>
      </nav>
    </header>
  );
} 