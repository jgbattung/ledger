import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { ExerciseSearchField } from '@/components/library/ExerciseSearchField'
import { FilterChipRow } from '@/components/library/FilterChipRow'
import { FilterSheet } from '@/components/library/FilterSheet'
import type { Facet } from '@/components/library/types'
import { filterExercises, getFilterOptions } from '@/exercises/filtering'
import type { LibraryFilters } from '@/exercises/filtering'
import type { Exercise } from '@/exercises/types'

const EMPTY_FILTERS: LibraryFilters = { muscle: null, category: null, equipment: null }

/**
 * Search field, filter chips, filter sheet, result count, results list and
 * empty state shared by the program picker and the swap picker. Selection
 * behaviour stays with each page: it supplies the header above the search
 * field, how a result row renders (`renderRow` returns the row's content,
 * wrapped in the list item here) and an optional sticky `footer`.
 */
export function ExerciseSearchPanel({
  header,
  renderRow,
  footer,
}: {
  header: ReactNode
  renderRow: (exercise: Exercise) => ReactNode
  footer?: ReactNode
}) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS)
  const [openFacet, setOpenFacet] = useState<Facet | null>(null)

  const deferredQuery = useDeferredValue(query)
  const results = useMemo(() => filterExercises(deferredQuery, filters), [deferredQuery, filters])
  const filterOptions = useMemo(() => getFilterOptions(), [])

  const facetOptions: Record<Facet, string[]> = {
    muscle: filterOptions.muscles,
    category: filterOptions.categories,
    equipment: filterOptions.equipment,
  }

  const reset = () => {
    setQuery('')
    setFilters(EMPTY_FILTERS)
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 bg-background px-4 pb-3">
        {header}
        <div className="flex flex-col gap-2">
          <ExerciseSearchField value={query} onChange={setQuery} />
          <FilterChipRow
            filters={filters}
            onOpenFacet={setOpenFacet}
            onClearFacet={(facet) => setFilters((prev) => ({ ...prev, [facet]: null }))}
          />
        </div>
      </div>

      <div className="flex-1 px-4">
        <p className="text-sm text-muted-foreground tabular-nums">
          {results.length} {results.length === 1 ? 'exercise' : 'exercises'}
        </p>

        {results.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-3 py-8 text-center">
            <p className="text-base text-foreground">No exercises match</p>
            <p className="text-sm text-muted-foreground">
              Nothing matches your search and filters. Try clearing them.
            </p>
            <button
              type="button"
              onClick={reset}
              className="min-h-touch-min rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Clear search & filters
            </button>
          </div>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {results.map((exercise) => (
              <li key={exercise.id}>{renderRow(exercise)}</li>
            ))}
          </ul>
        )}
      </div>

      {footer}

      <FilterSheet
        facet={openFacet}
        options={openFacet ? facetOptions[openFacet] : []}
        selected={openFacet ? filters[openFacet] : null}
        onSelect={(value) => {
          if (openFacet) setFilters((prev) => ({ ...prev, [openFacet]: value }))
          setOpenFacet(null)
        }}
        onOpenChange={(open) => {
          if (!open) setOpenFacet(null)
        }}
      />
    </div>
  )
}
