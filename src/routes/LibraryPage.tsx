import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { filterExercises, getFilterOptions } from '@/exercises/filtering'
import type { LibraryFilters } from '@/exercises/filtering'
import { BackLink } from '@/components/BackLink'
import { ExerciseSearchField } from '@/components/library/ExerciseSearchField'
import { FilterChipRow } from '@/components/library/FilterChipRow'
import { FilterSheet } from '@/components/library/FilterSheet'
import { EmptyResults } from '@/components/library/ExerciseSearchPanel'
import { NewExerciseButton } from '@/components/library/NewExerciseButton'
import { ExerciseListItem } from '@/components/library/ExerciseListItem'
import type { Facet } from '@/components/library/types'
import { exercisePath } from '@/exercises/detail'
import { refKey } from '@/exercises/listing'
import { useScrollRestore } from '@/lib/useScrollRestore'
import { selectLive, useCustomExerciseStore } from '@/stores/customExerciseStore'

const createHref = (query: string) => `/exercises/new?name=${encodeURIComponent(query)}`

export function LibraryPage() {
  // Search and filters live in the URL (replace, so typing never grows the
  // history stack) so Back from an exercise page restores them.
  const [searchParams, setSearchParams] = useSearchParams()
  const [openFacet, setOpenFacet] = useState<Facet | null>(null)
  const root = useRef<HTMLDivElement>(null)
  useScrollRestore(root)

  const filterOptions = useMemo(() => getFilterOptions(), [])
  const facetOptions: Record<Facet, string[]> = {
    muscle: filterOptions.muscles,
    category: filterOptions.categories,
    equipment: filterOptions.equipment,
  }

  // The query lives in local state so the input stays synchronous (router state
  // commits asynchronously and would drop characters and move the caret). The URL
  // is a write-only mirror: read once on mount, never synced back into the input.
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const filters = useMemo<LibraryFilters>(() => {
    // Unknown values in a hand-edited URL are ignored.
    const read = (name: Facet, options: string[]) => {
      const value = searchParams.get(name)
      return value !== null && options.includes(value) ? value : null
    }
    return {
      muscle: read('muscle', filterOptions.muscles),
      category: read('category', filterOptions.categories),
      equipment: read('equipment', filterOptions.equipment),
    }
  }, [searchParams, filterOptions])

  const update = (patch: Partial<Record<'q' | Facet, string | null>>) => {
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params)
        for (const [name, value] of Object.entries(patch)) {
          if (value) next.set(name, value)
          else next.delete(name)
        }
        return next
      },
      { replace: true },
    )
  }

  const deferredQuery = useDeferredValue(query)
  const custom = useCustomExerciseStore(selectLive)
  const results = useMemo(
    () => filterExercises(deferredQuery, filters, custom),
    [deferredQuery, filters, custom],
  )

  const reset = () => {
    setQuery('')
    update({ q: null, muscle: null, category: null, equipment: null })
  }

  return (
    <div ref={root}>
      <div className="sticky top-0 z-10 -mx-4 bg-background px-4 pt-6 pb-3">
        <div className="flex items-center justify-between">
          <BackLink to="/more" label="Back to More" />
          <NewExerciseButton to="/exercises/new" />
        </div>
        <h1 className="text-2xl font-semibold">Library</h1>
        <div className="mt-3 flex flex-col gap-2">
          <ExerciseSearchField value={query} onChange={(value) => {
              setQuery(value)
              update({ q: value })
            }} />
          <FilterChipRow
            filters={filters}
            onOpenFacet={setOpenFacet}
            onClearFacet={(facet) => update({ [facet]: null })}
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
          if (openFacet) update({ [openFacet]: value })
          setOpenFacet(null)
        }}
        onOpenChange={(open) => {
          if (!open) setOpenFacet(null)
        }}
      />
    </div>
  )
}
