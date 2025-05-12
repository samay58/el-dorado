import React from 'react';
import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div className={clsx('animate-pulse bg-gray-200 dark:bg-gray-800 rounded', className)} />
); 