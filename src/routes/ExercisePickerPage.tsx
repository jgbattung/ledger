import { useDeferredValue, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BackLink } from '@/components/BackLink'
import { ExerciseListItem } from '@/components/library/ExerciseListItem'
import { ExerciseSearchField } from '@/components/library/ExerciseSearchField'
import { FilterChipRow } from '@/components/library/FilterChipRow'
import { FilterSheet } from '@/components/library/FilterSheet'
import type { Facet } from '@/components/library/types'
import { PickerTray } from '@/components/programs/PickerTray'
import { getExerciseById } from '@/exercises/catalog'
import { filterExercises, getFilterOptions } from '@/exercises/filtering'
import type { LibraryFilters } from '@/exercises/filtering'
import { useProgramDraftStore } from '@/stores/programDraftStore'
import { cn } from '@/lib/utils'

const EMPTY_FILTERS: LibraryFilters = { muscle: null, category: null, equipment: null }

/**
 * Multi-select exercise picker for one day of the draft. Tap rows to toggle;
 * the check shows the add order. Back adds nothing; "Add N exercises" appends
 * the selection in order and returns to the editor.
 */
export function ExercisePickerPage() {
  const { programId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const draft = useProgramDraftStore((s) => s.draft)

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS)
  const [openFacet, setOpenFacet] = useState<Facet | null>(null)
  // Ordered ids of the exercises picked so far (selection order = add order).
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const deferredQuery = useDeferredValue(query)
  const results = useMemo(() => filterExercises(deferredQuery, filters), [deferredQuery, filters])
  const filterOptions = useMemo(() => getFilterOptions(), [])

  const editorPath = programId ? `/programs/${programId}` : '/programs/new'
  const dayId = searchParams.get('day')
  const day = draft?.days.find((d) => d.id === dayId)
  const routeMatches = draft && (programId ? draft.id === programId : draft.isNew)

  // No draft (e.g. after a reload) or an unknown day: the editor re-initialises.
  if (!draft || !day || !routeMatches) return <Navigate to={editorPath} replace />

  const inDay = new Set(
    day.exercises.flatMap((e) => (e.exerciseRef.source === 'db' ? [e.exerciseRef.exerciseId] : [])),
  )
  const selectedExercises = selectedIds.flatMap((id) => {
    const exercise = getExerciseById(id)
    return exercise ? [exercise] : []
  })

  const facetOptions: Record<Facet, string[]> = {
    muscle: filterOptions.muscles,
    category: filterOptions.categories,
    equipment: filterOptions.equipment,
  }

  const toggle = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const reset = () => {
    setQuery('')
    setFilters(EMPTY_FILTERS)
  }

  const add = () => {
    useProgramDraftStore.getState().addExercises(
      day.id,
      selectedIds.map((exerciseId) => ({ source: 'db' as const, exerciseId })),
    )
    navigate(-1)
  }

  const count = selectedIds.length

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 bg-background px-4 pb-3">
        <header className="flex h-[52px] items-center gap-2">
          <BackLink onBack={() => navigate(-1)} label="Back" />
          <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">
            Add to {day.name}
          </h1>
          <span aria-hidden="true" className="size-touch-min shrink-0" />
        </header>
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
            {results.map((exercise) => {
              const already = inDay.has(exercise.id)
              const order = selectedIds.indexOf(exercise.id) + 1
              const picked = order > 0
              return (
                <li key={exercise.id}>
                  <button
                    type="button"
                    aria-pressed={already ? undefined : picked}
                    disabled={already}
                    onClick={() => toggle(exercise.id)}
                    className="block w-full rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <ExerciseListItem
                      exercise={exercise}
                      muted={already}
                      subtitle={already ? `Already in ${day.name}` : undefined}
                      trailing={
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[13px] font-semibold tabular-nums',
                            picked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : already
                                ? 'border-dashed border-border'
                                : 'border-border',
                          )}
                        >
                          {picked ? order : null}
                        </span>
                      }
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {count > 0 ? (
        <div className="sticky bottom-0 z-10 flex flex-col gap-2.5 border-t border-border bg-background px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <PickerTray
            selected={selectedExercises}
            onDeselect={(id) => setSelectedIds((prev) => prev.filter((x) => x !== id))}
          />
          <button
            type="button"
            onClick={add}
            className="flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Add {count} {count === 1 ? 'exercise' : 'exercises'}
          </button>
        </div>
      ) : null}

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
