'use client';

import { Toggle } from './Toggle';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  className?: string;
}

export default function ThemeToggle({ className }: Props) {
  const { theme, toggle } = useTheme();
  return <Toggle checked={theme === 'dark'} onChange={toggle} className={className} />;
} 