import { useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BackLink } from '@/components/BackLink'
import { ExerciseListItem } from '@/components/library/ExerciseListItem'
import { ExerciseSearchPanel } from '@/components/library/ExerciseSearchPanel'
import { PickerTray } from '@/components/programs/PickerTray'
import { getExerciseById } from '@/exercises/catalog'
import { useProgramDraftStore } from '@/stores/programDraftStore'
import { cn } from '@/lib/utils'

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

  // Ordered ids of the exercises picked so far (selection order = add order).
  const [selectedIds, setSelectedIds] = useState<string[]>([])

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

  const toggle = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const add = () => {
    useProgramDraftStore.getState().addExercises(
      day.id,
      selectedIds.map((exerciseId) => ({ source: 'db' as const, exerciseId })),
    )
    navigate(-1)
  }

  const count = selectedIds.length

  return (
    <ExerciseSearchPanel
      header={
        <header className="flex h-[52px] items-center gap-2">
          <BackLink onBack={() => navigate(-1)} label="Back" />
          <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">
            Add to {day.name}
          </h1>
          <span aria-hidden="true" className="size-touch-min shrink-0" />
        </header>
      }
      renderRow={(exercise) => {
        const already = inDay.has(exercise.id)
        const order = selectedIds.indexOf(exercise.id) + 1
        const picked = order > 0
        return (
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
        )
      }}
      footer={
        count > 0 ? (
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
        ) : null
      }
    />
  )
}
