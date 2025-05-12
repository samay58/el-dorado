import React from 'react';
import clsx from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  iconLeft?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ iconLeft, className, ...props }) => {
  const paddingLeft = iconLeft ? 'pl-10' : 'pl-3';
  return (
    <div className="relative w-full">
      {iconLeft && <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">{iconLeft}</span>}
      <input
        className={clsx(
          'block w-full rounded-md border border-gray-300 bg-white dark:bg-gray-900 dark:border-gray-700 focus:ring-brand-500 focus:border-brand-500 text-sm',
          paddingLeft,
          className
        )}
        {...props}
      />
    </div>
  );
}; 