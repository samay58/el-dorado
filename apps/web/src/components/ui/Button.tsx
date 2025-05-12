import React from 'react';
import clsx from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-brand-600 hover:bg-brand-500 text-white focus:ring-brand-600',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900 focus:ring-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white dark:focus:ring-gray-700',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-900 focus:ring-gray-200 dark:hover:bg-gray-800 dark:text-white',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-sm rounded',
  md: 'px-4 py-2 text-sm rounded-md',
  lg: 'px-6 py-3 text-base rounded-md',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) => {
  return (
    <button
      className={clsx(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}; 