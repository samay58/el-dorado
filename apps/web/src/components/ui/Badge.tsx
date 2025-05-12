import React from 'react';
import clsx from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const colorStyles: Record<NonNullable<BadgeProps['color']>, string> = {
  default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
  success: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100',
  danger: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100',
  info: 'bg-brand-100 text-brand-800 dark:bg-brand-800 dark:text-brand-100',
};

export const Badge: React.FC<BadgeProps> = ({ children, color = 'default', className }) => (
  <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', colorStyles[color], className)}>
    {children}
  </span>
); 