import { cn } from '@/lib/utils'

/**
 * Filled stopwatch (design-system 10j, 10m). The hand is cut out in the
 * surface colour: `--background` on the top bar, `--card` on the rest sheet.
 */
export function Stopwatch({
  className,
  cutout = 'var(--background)',
}: {
  className?: string
  cutout?: string
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('size-4', className)}>
      <rect x="9.5" y="2" width="5" height="2.5" rx="1" fill="currentColor" />
      <rect x="11" y="4" width="2" height="3" fill="currentColor" />
      <path d="m18 6.5 1.5-1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="14" r="8" fill="currentColor" />
      <path d="M12 14V9.5" stroke={cutout} strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  )
}
