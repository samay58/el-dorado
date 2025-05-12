import React from 'react';
import clsx from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, padded = true }) => {
  return (
    <div className={clsx('rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm', className)}>
      <div className={clsx(padded && 'p-4 sm:p-6')}>{children}</div>
    </div>
  );
}; 