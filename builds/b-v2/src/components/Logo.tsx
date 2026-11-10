import { useId } from 'react';
import { Link } from 'react-router';
import { cx } from './ui';

export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={cx('size-8', className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7a5cff" />
          <stop offset="1" stopColor="#4b33e6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <path d="M21.2 11.3a7 7 0 1 0 0 9.4" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="22.6" cy="16" r="2.1" fill="#ff8a63" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cx('flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight', className)}>
      <LogoMark />
      <span>curio</span>
    </Link>
  );
}
