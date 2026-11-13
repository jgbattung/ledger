import { cn } from '@/lib/utils'

/**
 * "Deleted" marker (design-system 13g): same shape as the Custom pill, muted,
 * never red. A deleted custom exercise is still usable in the programs that
 * hold it, so it is a status, not an error.
 */
export function DeletedPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'ml-1.5 inline-block shrink-0 rounded-full border border-border px-2 py-px text-xs font-medium text-muted-foreground',
        className,
      )}
    >
      Deleted
    </span>
  )
}
