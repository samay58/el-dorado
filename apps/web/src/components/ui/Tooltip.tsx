import React, { Fragment } from 'react';
import { Transition } from '@headlessui/react';
import clsx from 'clsx';

interface TooltipProps {
  children: React.ReactNode; // trigger element
  content: React.ReactNode;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ children, content, className }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      <Transition
        as={Fragment}
        show={open}
        enter="transition ease-out duration-200"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <span
          className={clsx(
            'absolute z-50 bottom-full mb-2 w-max max-w-xs rounded bg-gray-800 text-xs text-white px-2 py-1 shadow-lg pointer-events-none',
            className
          )}
        >
          {content}
        </span>
      </Transition>
    </span>
  );
}; 