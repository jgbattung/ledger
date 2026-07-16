import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatFilterValue } from '@/exercises/filtering'
import type { LibraryFilters } from '@/exercises/filtering'
import { FACET_LABELS } from './types'
import type { Facet } from './types'

const FACETS: Facet[] = ['muscle', 'category', 'equipment']

type FilterChipRowProps = {
  filters: LibraryFilters
  onOpenFacet: (facet: Facet) => void
  onClearFacet: (facet: Facet) => void
}

/** Horizontal row of single-select filter chips (LIB-3). Inactive chips show
 * the facet name; active chips show the selected value and gain a clear
 * (X) zone. Tapping the label zone opens the facet's sheet. */
export function FilterChipRow({ filters, onOpenFacet, onClearFacet }: FilterChipRowProps) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {FACETS.map((facet) => {
        const value = filters[facet]
        const active = value !== null

        return (
          <div
            key={facet}
            className={cn(
              'flex min-h-touch-min shrink-0 items-center rounded-full text-sm font-medium',
              active
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-background text-foreground',
            )}
          >
            <button
              type="button"
              onClick={() => onOpenFacet(facet)}
              className={cn(
                'flex h-full items-center rounded-full px-3 outline-none',
                'focus-visible:ring-[3px] focus-visible:ring-ring/50',
              )}
            >
              {active ? formatFilterValue(value) : FACET_LABELS[facet]}
            </button>
            {active ? (
              <button
                type="button"
                onClick={() => onClearFacet(facet)}
                aria-label={`Clear ${FACET_LABELS[facet]} filter`}
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-full outline-none',
                  'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                )}
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
