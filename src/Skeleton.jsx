import React from 'react';

export default function Skeleton({ className = '' }) {
  return <span className={`skeleton ${className}`.trim()} aria-hidden="true" />;
}
