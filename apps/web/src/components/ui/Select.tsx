import React from 'react';
import clsx from 'clsx';

interface Option {
  label: string;
  value: string | number;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Option[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({ options, placeholder, className, ...props }) => (
  <select
    className={clsx(
      'block w-full rounded-md border border-gray-300 bg-white dark:bg-gray-900 dark:border-gray-700 focus:ring-brand-500 focus:border-brand-500 text-sm py-2 pl-3 pr-10',
      className
    )}
    {...props}
  >
    {placeholder && (
      <option value="" disabled={props.required} hidden={props.required}>
        {placeholder}
      </option>
    )}
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
); 