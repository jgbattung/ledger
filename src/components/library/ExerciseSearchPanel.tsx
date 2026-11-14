import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ExerciseSearchField } from '@/components/library/ExerciseSearchField'
import { FilterChipRow } from '@/components/library/FilterChipRow'
import { FilterSheet } from '@/components/library/FilterSheet'
import type { Facet } from '@/components/library/types'
import { filterExercises, getFilterOptions } from '@/exercises/filtering'
import type { LibraryFilters } from '@/exercises/filtering'
import { refKey } from '@/exercises/listing'
import type { ListedExercise } from '@/exercises/listing'
import { selectLive, useCustomExerciseStore } from '@/stores/customExerciseStore'

export function EmptyResults({
  query,
  createHref,
  onReset,
}: {
  query: string
  createHref?: (query: string) => string
  onReset: () => void
}) {
  const typed = query.trim()
  const canCreate = createHref !== undefined && typed !== ''
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 py-8 text-center">
      <p className="text-base text-foreground">No exercises match</p>
      <p className="text-sm text-muted-foreground">
        {canCreate
          ? 'Nothing in the library is called that.'
          : 'Nothing matches your search and filters. Try clearing them.'}
      </p>
      {canCreate ? (
        <Link
          to={createHref(typed)}
          className="flex min-h-touch-min items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Create &quot;{typed}&quot;
        </Link>
      ) : null}
      <button
        type="button"
        onClick={onReset}
        className={
          canCreate
            ? 'min-h-touch-min rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
            : 'min-h-touch-min rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
        }
      >
        Clear search & filters
      </button>
    </div>
  )
}

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
  createHref,
}: {
  header: ReactNode
  renderRow: (exercise: ListedExercise) => ReactNode
  footer?: ReactNode
  /** Where `Create "query"` goes (the custom exercise form); omit to hide it. */
  createHref?: (query: string) => string
}) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS)
  const [openFacet, setOpenFacet] = useState<Facet | null>(null)

  const deferredQuery = useDeferredValue(query)
  const custom = useCustomExerciseStore(selectLive)
  const results = useMemo(
    () => filterExercises(deferredQuery, filters, custom),
    [deferredQuery, filters, custom],
  )
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
          <EmptyResults query={query} createHref={createHref} onReset={reset} />
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {results.map((exercise) => (
              <li key={refKey(exercise.ref)}>{renderRow(exercise)}</li>
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
