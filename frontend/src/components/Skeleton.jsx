import React from 'react';

/**
 * Skeleton loader component for placeholder UI
 */
export const Skeleton = ({ className = '', width = 'w-full', height = 'h-4' }) => (
  <div className={`${width} ${height} bg-gray-200 rounded animate-pulse ${className}`} />
);

/**
 * Table skeleton loader
 */
export const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, j) => (
          <Skeleton key={j} height="h-10" />
        ))}
      </div>
    ))}
  </div>
);

/**
 * Card skeleton loader
 */
export const CardSkeleton = ({ count = 3 }) => (
  <div className="grid gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white rounded-lg shadow p-4 space-y-3">
        <Skeleton height="h-6" width="w-3/4" />
        <Skeleton height="h-4" width="w-1/2" />
        <div className="space-y-2 pt-2">
          <Skeleton height="h-4" />
          <Skeleton height="h-4" width="w-4/5" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Form skeleton loader
 */
export const FormSkeleton = () => (
  <div className="space-y-4">
    <div>
      <Skeleton height="h-4" width="w-20" className="mb-2" />
      <Skeleton height="h-10" />
    </div>
    <div>
      <Skeleton height="h-4" width="w-20" className="mb-2" />
      <Skeleton height="h-10" />
    </div>
    <div>
      <Skeleton height="h-4" width="w-20" className="mb-2" />
      <Skeleton height="h-24" />
    </div>
    <Skeleton height="h-10" width="w-32" />
  </div>
);

/**
 * List skeleton loader
 */
export const ListSkeleton = ({ count = 5 }) => (
  <div className="space-y-2">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="bg-white rounded-lg shadow p-4 flex items-center gap-4"
      >
        <Skeleton height="h-12" width="w-12" className="rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton height="h-4" width="w-1/3" />
          <Skeleton height="h-3" width="w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Dashboard stat card skeleton
 */
export const StatSkeleton = ({ count = 4 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white rounded-lg shadow p-6 space-y-3">
        <Skeleton height="h-4" width="w-1/2" />
        <Skeleton height="h-8" width="w-3/4" />
        <Skeleton height="h-3" width="w-2/3" />
      </div>
    ))}
  </div>
);
