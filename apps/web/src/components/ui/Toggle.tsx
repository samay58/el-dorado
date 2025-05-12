import React from 'react';
import clsx from 'clsx';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, className }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={clsx(
      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500',
      checked ? 'bg-brand-600' : 'bg-gray-400',
      className
    )}
  >
    <span
      className={clsx(
        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
        checked ? 'translate-x-6' : 'translate-x-1'
      )}
    />
  </button>
); 