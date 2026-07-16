import { useDeferredValue, useMemo, useState } from 'react'
import { filterExercises, getFilterOptions } from '@/exercises/filtering'
import type { LibraryFilters } from '@/exercises/filtering'
import { ExerciseSearchField } from '@/components/library/ExerciseSearchField'
import { FilterChipRow } from '@/components/library/FilterChipRow'
import { FilterSheet } from '@/components/library/FilterSheet'
import { ExerciseListItem } from '@/components/library/ExerciseListItem'
import type { Facet } from '@/components/library/types'

const EMPTY_FILTERS: LibraryFilters = { muscle: null, category: null, equipment: null }

export function LibraryPage() {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS)
  const [openFacet, setOpenFacet] = useState<Facet | null>(null)

  const deferredQuery = useDeferredValue(query)
  const results = useMemo(
    () => filterExercises(deferredQuery, filters),
    [deferredQuery, filters],
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
    <div>
      <div className="sticky top-0 z-10 -mx-4 bg-background px-4 pb-3">
        <h1 className="text-2xl font-semibold">Library</h1>
        <div className="mt-3 flex flex-col gap-2">
          <ExerciseSearchField value={query} onChange={setQuery} />
          <FilterChipRow
            filters={filters}
            onOpenFacet={setOpenFacet}
            onClearFacet={(facet) => setFilters((prev) => ({ ...prev, [facet]: null }))}
          />
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
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
        <div className="mt-1 divide-y divide-border">
          {results.map((exercise) => (
            <ExerciseListItem key={exercise.id} exercise={exercise} />
          ))}
        </div>
      )}

      <FilterSheet
        facet={openFacet}
        options={openFacet ? facetOptions[openFacet] : []}
        selected={openFacet ? filters[openFacet] : null}
        onSelect={(value) => {
          if (openFacet) {
            setFilters((prev) => ({ ...prev, [openFacet]: value }))
          }
          setOpenFacet(null)
        }}
        onOpenChange={(open) => {
          if (!open) setOpenFacet(null)
        }}
      />
    </div>
  )
}
