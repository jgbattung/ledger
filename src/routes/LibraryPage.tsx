import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { filterExercises } from '@/exercises/filtering'
import { BackLink } from '@/components/BackLink'
import { ExerciseSearchField } from '@/components/library/ExerciseSearchField'
import { FilterChipRow } from '@/components/library/FilterChipRow'
import { FilterSheet } from '@/components/library/FilterSheet'
import { EmptyResults } from '@/components/library/ExerciseSearchPanel'
import { useSearchParamsFilters } from '@/components/library/useSearchParamsFilters'
import { NewExerciseButton } from '@/components/library/NewExerciseButton'
import { ExerciseListItem } from '@/components/library/ExerciseListItem'
import type { Facet } from '@/components/library/types'
import { exercisePath } from '@/exercises/detail'
import { refKey } from '@/exercises/listing'
import { useScrollRestore } from '@/lib/useScrollRestore'
import { selectLive, useCustomExerciseStore } from '@/stores/customExerciseStore'

const createHref = (query: string) => `/exercises/new?name=${encodeURIComponent(query)}`

export function LibraryPage() {
  const { query, setQuery, filters, facetOptions, setFacet, reset } = useSearchParamsFilters()
  const [openFacet, setOpenFacet] = useState<Facet | null>(null)
  const root = useRef<HTMLDivElement>(null)
  useScrollRestore(root)

  const deferredQuery = useDeferredValue(query)
  const custom = useCustomExerciseStore(selectLive)
  const results = useMemo(
    () => filterExercises(deferredQuery, filters, custom),
    [deferredQuery, filters, custom],
  )

  return (
    <div ref={root}>
      <div className="sticky top-0 z-10 -mx-4 bg-background px-4 pt-6 pb-3">
        <div className="flex items-center justify-between">
          <BackLink to="/more" label="Back to More" />
          <NewExerciseButton to="/exercises/new" />
        </div>
        <h1 className="text-2xl font-semibold">Library</h1>
        <div className="mt-3 flex flex-col gap-2">
          <ExerciseSearchField value={query} onChange={setQuery} />
          <FilterChipRow
            filters={filters}
            onOpenFacet={setOpenFacet}
            onClearFacet={(facet) => setFacet(facet, null)}
          />
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {results.length} {results.length === 1 ? 'exercise' : 'exercises'}
      </p>

      {results.length === 0 ? (
        <EmptyResults query={query} createHref={createHref} onReset={reset} />
      ) : (
        <div className="mt-1 divide-y divide-border">
          {results.map((exercise) => (
            <Link
              key={refKey(exercise.ref)}
              to={exercisePath(exercise.ref)}
              className="block outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
            >
              <ExerciseListItem exercise={exercise} />
            </Link>
          ))}
        </div>
      )}

      <FilterSheet
        facet={openFacet}
        options={openFacet ? facetOptions[openFacet] : []}
        selected={openFacet ? filters[openFacet] : null}
        onSelect={(value) => {
          if (openFacet) setFacet(openFacet, value)
          setOpenFacet(null)
        }}
        onOpenChange={(open) => {
          if (!open) setOpenFacet(null)
        }}
      />
    </div>
  )
}
