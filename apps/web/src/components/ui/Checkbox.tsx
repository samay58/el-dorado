import React from 'react';
import clsx from 'clsx';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Checkbox: React.FC<CheckboxProps> = ({ className, ...props }) => (
  <input
    type="checkbox"
    className={clsx(
      'h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:bg-gray-900 dark:border-gray-700',
      className
    )}
    {...props}
  />
); 