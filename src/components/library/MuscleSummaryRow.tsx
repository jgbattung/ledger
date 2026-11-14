import { ChevronRight } from 'lucide-react'
import { formatFilterValue } from '@/exercises/filtering'
import type { Muscle } from '@/exercises/types'
import { cn } from '@/lib/utils'
import { MuscleFigure } from './MuscleFigure'

/**
 * Primary / Secondary row on the custom exercise form (design-system 13a): up
 * to two small figures, the caption over the chosen names, a chevron. One
 * button of at least 56px that opens the muscle step page.
 */
export function MuscleSummaryRow({
  caption,
  muscles,
  first,
  invalid,
  describedBy,
  onClick,
}: {
  caption: 'Primary' | 'Secondary'
  muscles: Muscle[]
  first?: boolean
  invalid?: boolean
  describedBy?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-describedby={describedBy}
      className={cn(
        'flex min-h-14 w-full items-center gap-2.5 border-b border-border py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50',
        first && 'border-t',
        invalid && 'border-foreground',
      )}
    >
      {muscles.length > 0 ? (
        <span className="flex gap-0.5" aria-hidden="true">
          {muscles.slice(0, 2).map((muscle) => (
            <MuscleFigure key={muscle} highlight={[muscle]} className="h-9 w-7" />
          ))}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm text-muted-foreground">{caption}</span>
        <span className={cn('truncate text-base', muscles.length === 0 && 'text-muted-foreground')}>
          {muscles.length > 0 ? muscles.map(formatFilterValue).join(', ') : 'Choose muscles'}
        </span>
      </span>
      <ChevronRight className="size-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  )
}
